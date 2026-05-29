const pool = require('../db');
const { oauth2Client } = require('../googleCalendar');
const { google } = require('googleapis');
const { sendFeedbackEmail } = require('../utils/mailer');

// Helper to set credentials for a specific admin user
const setGoogleAuth = async (email) => {
    const [rows] = await pool.execute('SELECT google_tokens FROM users WHERE email = ? AND role = "admin"', [email.toLowerCase()]);
    if (!rows.length || !rows[0].google_tokens) {
        throw new Error('Admin Google tokens not found. Please reconnect Google Calendar.');
    }
    const tokens = typeof rows[0].google_tokens === 'string' ? JSON.parse(rows[0].google_tokens) : rows[0].google_tokens;
    oauth2Client.setCredentials(tokens);
    return google.forms({ version: 'v1', auth: oauth2Client });
};

exports.generateForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const adminEmail = req.user.email; // from verifyToken

        // Check if event already has a form
        const [eventRows] = await pool.execute('SELECT title, google_form_id FROM events WHERE event_id = ?', [eventId]);
        if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });
        
        const event = eventRows[0];
        if (event.google_form_id) {
            return res.status(400).json({ error: 'Form already exists for this event' });
        }

        const formsAPI = await setGoogleAuth(adminEmail);

        // 1. Create a blank form
        const createRes = await formsAPI.forms.create({
            requestBody: {
                info: {
                    title: `Feedback: ${event.title}`,
                    documentTitle: `Feedback Form - ${event.title}`
                }
            }
        });

        const formId = createRes.data.formId;
        const responderUri = createRes.data.responderUri;
        // The edit URL is standard format
        const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

        // 2. Add the baseline questions
        await formsAPI.forms.batchUpdate({
            formId,
            requestBody: {
                requests: [
                    {
                        createItem: {
                            item: {
                                title: "How would you rate this event?",
                                questionItem: {
                                    question: {
                                        required: true,
                                        scaleQuestion: {
                                            low: 1,
                                            high: 5,
                                            lowLabel: "Poor",
                                            highLabel: "Excellent"
                                        }
                                    }
                                }
                            },
                            location: { index: 0 }
                        }
                    },
                    {
                        createItem: {
                            item: {
                                title: "Any additional comments?",
                                questionItem: {
                                    question: {
                                        textQuestion: {
                                            paragraph: true
                                        }
                                    }
                                }
                            },
                            location: { index: 1 }
                        }
                    }
                ]
            }
        });

        // 3. Save to database
        await pool.execute('UPDATE events SET google_form_id = ?, google_form_url = ? WHERE event_id = ?', [formId, responderUri, eventId]);

        res.json({ success: true, editUrl, responderUri, formId });

    } catch (e) {
        console.error('generateForm error:', e);
        res.status(500).json({ error: 'Failed to generate form. Please log out and back in to grant Google Forms permissions.' });
    }
};

exports.sendForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const [eventRows] = await pool.execute('SELECT title, google_form_url FROM events WHERE event_id = ?', [eventId]);
        
        if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });
        const event = eventRows[0];
        
        if (!event.google_form_url) {
            return res.status(400).json({ error: 'Feedback form has not been created yet' });
        }

        // Fetch all attendees for this event
        const [attendees] = await pool.execute(
            `SELECT a.email, a.name 
             FROM Attendees a 
             JOIN Event_Attendees ea ON a.attendee_id = ea.attendee_id 
             WHERE ea.event_id = ?`, 
            [eventId]
        );

        if (!attendees.length) {
            return res.status(400).json({ error: 'No attendees found for this event' });
        }

        let sentCount = 0;
        for (const person of attendees) {
            try {
                await sendFeedbackEmail({
                    email: person.email,
                    name: person.name,
                    eventTitle: event.title,
                    formUrl: event.google_form_url
                });
                sentCount++;
            } catch (err) {
                console.error(`Failed to send feedback email to ${person.email}:`, err.message);
            }
        }

        res.json({ success: true, sentCount, total: attendees.length });

    } catch (e) {
        console.error('sendForm error:', e);
        res.status(500).json({ error: 'Failed to send feedback emails' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const { eventId } = req.params;
        const adminEmail = req.user.email; 

        const [eventRows] = await pool.execute('SELECT google_form_id FROM events WHERE event_id = ?', [eventId]);
        if (!eventRows.length || !eventRows[0].google_form_id) {
            return res.json({ stats: null });
        }
        const formId = eventRows[0].google_form_id;

        const formsAPI = await setGoogleAuth(adminEmail);

        // 1. Fetch the form structure to find the scaleQuestion ID
        const formInfo = await formsAPI.forms.get({ formId });
        let ratingQuestionId = null;
        let maxRating = 5;

        if (formInfo.data.items) {
            for (const item of formInfo.data.items) {
                if (item.questionItem && item.questionItem.question && item.questionItem.question.scaleQuestion) {
                    ratingQuestionId = item.questionItem.question.questionId;
                    maxRating = item.questionItem.question.scaleQuestion.high || 5;
                    break;
                }
            }
        }

        // 2. Fetch responses
        const responsesRes = await formsAPI.forms.responses.list({ formId });
        const responses = responsesRes.data.responses || [];

        let totalResponses = responses.length;
        let sumRating = 0;
        let ratedCount = 0;
        let ratingDistribution = {};
        for (let i = 1; i <= maxRating; i++) {
            ratingDistribution[i] = 0;
        }

        if (ratingQuestionId && totalResponses > 0) {
            for (const response of responses) {
                const answers = response.answers;
                if (answers && answers[ratingQuestionId] && answers[ratingQuestionId].textAnswers) {
                    const val = parseFloat(answers[ratingQuestionId].textAnswers.answers[0].value);
                    if (!isNaN(val)) {
                        sumRating += val;
                        ratedCount++;
                        if (ratingDistribution[val] !== undefined) {
                            ratingDistribution[val]++;
                        } else {
                            ratingDistribution[val] = 1;
                        }
                    }
                }
            }
        }

        const avgRating = ratedCount > 0 ? (sumRating / ratedCount).toFixed(1) : 0;

        res.json({
            stats: {
                totalResponses,
                avgRating: parseFloat(avgRating),
                ratingDistribution,
                maxRating,
                formUrl: `https://docs.google.com/forms/d/${formId}/edit`
            }
        });

    } catch (e) {
        console.error('getStats error:', e);
        res.status(500).json({ error: 'Failed to fetch form statistics' });
    }
};
