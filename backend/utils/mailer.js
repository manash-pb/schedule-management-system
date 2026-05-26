const nodemailer = require('nodemailer');
const pool = require('../db');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const formatTime12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const buildICS = ({ event_date, mysqlStart, mysqlEnd, title, description, venue, newEventId, recipientEmail }) => {
    const toICSDate = (d, t) => {
        const timeStr = t.split(':').length === 2 ? `${t}:00` : t;
        return d.replace(/-/g, '') + 'T' + timeStr.replace(/:/g, '').slice(0, 6);
    };
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Schedule Manager//EN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${Date.now()}-${newEventId}@schedulemanager`,
        `DTSTART;TZID=Asia/Kolkata:${toICSDate(event_date, mysqlStart)}`,
        `DTEND;TZID=Asia/Kolkata:${toICSDate(event_date, mysqlEnd)}`,
        `SUMMARY:${title}`,
        description ? `DESCRIPTION:${description.replace(/\\n/g, '\\\\n')}` : '',
        `LOCATION:${venue || ''}`,
        `ORGANIZER;CN=Schedule Manager:mailto:${process.env.SMTP_USER}`,
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${recipientEmail}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'SEQUENCE:0',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
};

const buildCancelICS = ({ eventId, title, recipientEmail }) => [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Manager//EN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:cancel-${eventId}@schedulemanager`,
    `SUMMARY:${title}`,
    `ORGANIZER;CN=Schedule Manager:mailto:${process.env.SMTP_USER}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${recipientEmail}`,
    'STATUS:CANCELLED',
    'SEQUENCE:1',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

const sendInviteEmail = async ({ person, title, description, venue, event_date, mysqlStart, mysqlEnd, newEventId }) => {
    const isVideoLink = venue && /^https?:\/\//i.test(venue.trim());
    const formattedDate = new Date(event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const icsContent = buildICS({ event_date, mysqlStart, mysqlEnd, title, description, venue, newEventId, recipientEmail: person.email });

    // RSVP links removed — no accept/decline via email anymore

    const venueRow = isVideoLink
        ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;">📹 <strong>Link</strong></td><td style="padding:8px 0;"><a href="${venue}" style="color:#2563eb;">${venue}</a></td></tr>`
        : `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;">📍 <strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${venue}</td></tr>`;

    const descriptionBlock = description
        ? `<div style="margin:20px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:6px;font-size:14px;color:#475569;line-height:1.6;">${description}</div>`
        : '';

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 36px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#bfdbfe;letter-spacing:0.08em;text-transform:uppercase;">You're Invited</p>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${person.name}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">You have been invited to the following event.</p>
            ${descriptionBlock}
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-top:8px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📅 <strong>Date</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">🕐 <strong>Time</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formatTime12(mysqlStart)} – ${formatTime12(mysqlEnd)}</td>
              </tr>
              ${venueRow}
            </table>
            ${isVideoLink ? `<div style="text-align:center;margin-top:28px;"><a href="${venue}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">Join Meeting</a></div>` : ''}

            <!-- RSVP buttons removed -->
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This invite was sent by <strong>Schedule Manager</strong>. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: person.email,
        subject: `You're invited: ${title}`,
        html,
        headers: { 'X-Priority': '1', 'Importance': 'high' },
        icalEvent: {
            filename: 'invite.ics',
            method: 'request',
            content: icsContent
        }
    });
};

const sendCancellationEmail = async ({ name, email, event }) => {
    const formattedDate = new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const icsCancel = buildCancelICS({ eventId: event.event_id, title: event.title, recipientEmail: email });

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 36px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#fecaca;letter-spacing:0.08em;text-transform:uppercase;">Event Cancelled</p>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">${event.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">The following event has been <strong style="color:#ef4444;">cancelled</strong>.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📅 <strong>Date</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">🕐 <strong>Time</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formatTime12(event.start_time)} – ${formatTime12(event.end_time)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 <strong>Venue</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${event.venue}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This notice was sent by <strong>Schedule Manager</strong>. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Event Cancelled: ${event.title}`,
        html,
        headers: { 'X-Priority': '1', 'Importance': 'high' },
        icalEvent: {
            filename: 'cancel.ics',
            method: 'cancel',
            content: icsCancel
        }
    });
};

const sendRemovalEmail = async ({ name, email, event }) => {
    const formattedDate = new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 36px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#fed7aa;letter-spacing:0.08em;text-transform:uppercase;">Removed from Event</p>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">${event.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">You have been <strong style="color:#ea580c;">removed</strong> from the following event.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📅 <strong>Date</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">🕐 <strong>Time</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formatTime12(event.start_time)} – ${formatTime12(event.end_time)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 <strong>Venue</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${event.venue || '—'}</td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">If you think this was a mistake, please contact the event organiser.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This notice was sent by <strong>Schedule Manager</strong>. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `You've been removed from: ${event.title}`,
        html,
        headers: { 'X-Priority': '1', 'Importance': 'high' },
    });
};

const sendQueryToAdmins = async ({ fromName, fromEmail, subject, message }) => {
    const [admins] = await pool.execute('SELECT email FROM users WHERE role = "admin"');
    const toAddresses = admins.map(admin => admin.email).filter(Boolean);

    if (!toAddresses.length) {
        throw new Error('No admin recipients found');
    }

    const mailSubject = subject && subject.trim()
        ? `User Query: ${subject.trim()}`
        : `User Query from ${fromName}`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; padding:24px;">
        <div style="max-width:720px; margin:0 auto; background:#ffffff; border-radius:18px; padding:24px; box-shadow:0 20px 40px rgba(15,23,42,0.08);">
          <h2 style="margin:0 0 10px; font-size:22px; color:#0f172a;">New user query</h2>
          <p style="margin:0 0 16px; color:#475569; font-size:14px; line-height:1.7;">A user has sent a message to the admin team via the query button.</p>
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <tr><td style="padding:8px 0; font-weight:700; color:#111827; width:110px;">Name:</td><td style="padding:8px 0; color:#334155;">${fromName}</td></tr>
            <tr><td style="padding:8px 0; font-weight:700; color:#111827;">Email:</td><td style="padding:8px 0; color:#334155;">${fromEmail}</td></tr>
            ${subject ? `<tr><td style="padding:8px 0; font-weight:700; color:#111827;">Subject:</td><td style="padding:8px 0; color:#334155;">${subject}</td></tr>` : ''}
          </table>
          <div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:14px; padding:18px; color:#334155; font-size:15px; line-height:1.7; white-space:pre-wrap;">${message}</div>
        </div>
      </div>
    `;

    const text = `New user query from ${fromName} <${fromEmail}>\n\n${subject ? `Subject: ${subject}\n\n` : ''}${message}`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: toAddresses.join(','),
        subject: mailSubject,
        text,
        html,
    });
};

const sendUserReplyEmail = async ({ toName, toEmail, querySubject, originalMessage, replyMessage }) => {
    const subject = `Reply to your query: ${querySubject}`;
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; padding:24px;">
        <div style="max-width:720px; margin:0 auto; background:#ffffff; border-radius:18px; padding:24px; box-shadow:0 20px 40px rgba(15,23,42,0.08);">
          <h2 style="margin:0 0 10px; font-size:22px; color:#0f172a;">Reply to your query</h2>
          <p style="margin:0 0 16px; color:#475569; font-size:14px; line-height:1.7;">Hello ${toName},</p>
          <div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:14px; padding:18px; color:#334155; font-size:15px; line-height:1.7; white-space:pre-wrap; margin-bottom: 20px;">
            <strong>Your original query:</strong><br />${originalMessage}
          </div>
          <div style="background:#ecfdf5; border:1px solid #d1fae5; border-radius:14px; padding:18px; color:#065f46; font-size:15px; line-height:1.7; white-space:pre-wrap;">
            <strong>Admin response:</strong><br />${replyMessage}
          </div>
          <p style="margin:24px 0 0; color:#475569; font-size:14px; line-height:1.7;">If you have more questions, feel free to reply to this email.</p>
        </div>
      </div>
    `;

    const text = `Hello ${toName},\n\nThis is a reply to your query:\n\n${originalMessage}\n\nAdmin response:\n${replyMessage}\n\nThank you.`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject,
        text,
        html,
    });
};

const buildMultiDayICS = ({ title, description, venue, days, createdEventIds, recipientEmail }) => {
    const toICSDate = (d, t) => {
        const timeStr = t.split(':').length === 2 ? `${t}:00` : t;
        return d.replace(/-/g, '') + 'T' + timeStr.replace(/:/g, '').slice(0, 6);
    };
    const calendarParts = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Schedule Manager//EN',
        'METHOD:REQUEST'
    ];

    days.forEach((day, index) => {
        const dayDate = day.date;
        const dayStart = day.start_time;
        const dayEnd = day.end_time;
        const dayTitle = day.title || title;
        const dayDescription = day.description || description;
        const newEventId = createdEventIds[index] || index;

        calendarParts.push(
            'BEGIN:VEVENT',
            `UID:${Date.now()}-${newEventId}-${index}@schedulemanager`,
            `DTSTART;TZID=Asia/Kolkata:${toICSDate(dayDate, dayStart)}`,
            `DTEND;TZID=Asia/Kolkata:${toICSDate(dayDate, dayEnd)}`,
            `SUMMARY:${dayTitle}`,
            dayDescription ? `DESCRIPTION:${dayDescription.replace(/\\n/g, '\\\\n')}` : '',
            `LOCATION:${venue || ''}`,
            `ORGANIZER;CN=Schedule Manager:mailto:${process.env.SMTP_USER}`,
            `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${recipientEmail}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'SEQUENCE:0',
            'BEGIN:VALARM',
            'TRIGGER:-PT30M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Reminder',
            'END:VALARM',
            'END:VEVENT'
        );
    });

    calendarParts.push('END:VCALENDAR');
    return calendarParts.filter(Boolean).join('\r\n');
};

const sendMultiDayInviteEmail = async ({ person, title, description, venue, days, createdEventIds }) => {
    const isVideoLink = venue && /^https?:\/\//i.test(venue.trim());
    const icsContent = buildMultiDayICS({ title, description, venue, days, createdEventIds, recipientEmail: person.email });

    const venueRow = isVideoLink
        ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📹 <strong>Link</strong></td><td style="padding:8px 0;"><a href="${venue}" style="color:#2563eb;">${venue}</a></td></tr>`
        : `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📍 <strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${venue}</td></tr>`;

    const descriptionBlock = description
        ? `<div style="margin:20px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:6px;font-size:14px;color:#475569;line-height:1.6;">${description}</div>`
        : '';

    // Construct the Schedule Table
    let scheduleRows = '';
    days.forEach((day, index) => {
        const formattedDate = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const dayTitle = day.title || `Day ${index + 1}`;
        scheduleRows += `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;width:120px;">📅 ${formattedDate}</td>
            <td style="padding:12px 0;font-size:13px;color:#475569;white-space:nowrap;width:160px;">🕐 ${formatTime12(day.start_time)} – ${formatTime12(day.end_time)}</td>
            <td style="padding:12px 0;font-size:13px;color:#0f172a;">
              <strong>${dayTitle}</strong>
              ${day.description ? `<br/><span style="font-size:11px;color:#64748b;">${day.description}</span>` : ''}
            </td>
          </tr>
        `;
    });

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 36px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#bfdbfe;letter-spacing:0.08em;text-transform:uppercase;">Multi-Day Event Invitation</p>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${person.name}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">You have been invited to the multi-day event <strong>${title}</strong>.</p>
            ${descriptionBlock}
            
            <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:24px 0 10px 0;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">📅 Event Schedule</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              ${scheduleRows}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-top:24px;">
              ${venueRow}
            </table>
            ${isVideoLink ? `<div style="text-align:center;margin-top:28px;"><a href="${venue}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">Join Meeting</a></div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This invite was sent by <strong>Schedule Manager</strong>. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: person.email,
        subject: `Invite (All Days): ${title}`,
        html,
        headers: { 'X-Priority': '1', 'Importance': 'high' },
        icalEvent: {
            filename: 'invite.ics',
            method: 'request',
            content: icsContent
        }
    });
};

const sendDaySpecificInviteEmail = async ({ person, globalTitle, globalDescription, dayTitle, dayDescription, venue, event_date, mysqlStart, mysqlEnd, newEventId }) => {
    const isVideoLink = venue && /^https?:\/\//i.test(venue.trim());
    const formattedDate = new Date(event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const fullDescription = `${globalDescription ? `Event Overview: ${globalDescription}\n` : ''}${dayDescription ? `Day Details: ${dayDescription}` : ''}`;
    const icsContent = buildICS({ event_date, mysqlStart, mysqlEnd, title: `${globalTitle} - ${dayTitle}`, description: fullDescription, venue, newEventId });

    const venueRow = isVideoLink
        ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📹 <strong>Link</strong></td><td style="padding:8px 0;"><a href="${venue}" style="color:#2563eb;">${venue}</a></td></tr>`
        : `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📍 <strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${venue}</td></tr>`;

    const descriptionBlock = (globalDescription || dayDescription)
        ? `<div style="margin:20px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:6px;font-size:14px;color:#475569;line-height:1.6;">
            ${globalDescription ? `<p style="margin:0 0 8px 0;"><strong>Event Overview:</strong> ${globalDescription}</p>` : ''}
            ${dayDescription ? `<p style="margin:0;"><strong>Day Details:</strong> ${dayDescription}</p>` : ''}
          </div>`
        : '';

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 36px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#bfdbfe;letter-spacing:0.08em;text-transform:uppercase;">Daily Invitation</p>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">${globalTitle}</h1>
            <p style="margin:6px 0 0 0;font-size:15px;color:#dbeafe;font-weight:600;">${dayTitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${person.name}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">You have been invited to <strong>${dayTitle}</strong> of the event <strong>${globalTitle}</strong>.</p>
            ${descriptionBlock}
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-top:8px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📅 <strong>Date</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">🕐 <strong>Time</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${formatTime12(mysqlStart)} – ${formatTime12(mysqlEnd)}</td>
              </tr>
              ${venueRow}
            </table>
            ${isVideoLink ? `<div style="text-align:center;margin-top:28px;"><a href="${venue}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">Join Meeting</a></div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This invite was sent by <strong>Schedule Manager</strong>. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
        to: person.email,
        subject: `Invite: ${globalTitle} - ${dayTitle}`,
        html,
        headers: { 'X-Priority': '1', 'Importance': 'high' },
        alternatives: [{ contentType: 'text/calendar; method=REQUEST; charset=UTF-8', content: icsContent }],
        attachments: [{ filename: 'invite.ics', content: icsContent, contentType: 'text/calendar; method=REQUEST; charset=UTF-8', contentDisposition: 'attachment' }],
    });
};

module.exports = { transporter, sendInviteEmail, sendCancellationEmail, sendRemovalEmail, sendQueryToAdmins, sendUserReplyEmail, sendMultiDayInviteEmail, sendDaySpecificInviteEmail };
