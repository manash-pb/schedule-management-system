const nodemailer = require('nodemailer');
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

const buildICS = ({ event_date, mysqlStart, mysqlEnd, title, description, venue, newEventId }) => {
    const toICSDate = (d, t) => d.replace(/-/g, '') + 'T' + t.replace(/:/g, '').slice(0, 6);
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
        'STATUS:CONFIRMED',
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

const buildCancelICS = ({ eventId, title }) => [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Manager//EN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:cancel-${eventId}@schedulemanager`,
    `SUMMARY:${title}`,
    'STATUS:CANCELLED',
    'SEQUENCE:1',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

const sendInviteEmail = async ({ person, title, description, venue, event_date, mysqlStart, mysqlEnd, newEventId }) => {
    const isVideoLink = venue && /^https?:\/\//i.test(venue.trim());
    const formattedDate = new Date(event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const icsContent = buildICS({ event_date, mysqlStart, mysqlEnd, title, description, venue, newEventId });

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const encodedEmail = encodeURIComponent(person.email);
    const acceptUrl  = `${backendUrl}/api/events/${newEventId}/rsvp?email=${encodedEmail}&status=accepted`;
    const declineUrl = `${backendUrl}/api/events/${newEventId}/rsvp?email=${encodedEmail}&status=declined`;

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

            <div style="margin-top:32px;padding:20px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
              <p style="margin:0 0 16px;font-size:14px;color:#475569;font-weight:600;">Will you attend?</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;">✅ Accept</a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;">❌ Decline</a>
                  </td>
                </tr>
              </table>
            </div>
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
        alternatives: [{ contentType: 'text/calendar; method=REQUEST; charset=UTF-8', content: icsContent }],
        attachments: [{ filename: 'invite.ics', content: icsContent, contentType: 'text/calendar; method=REQUEST; charset=UTF-8', contentDisposition: 'attachment' }],
    });
};

const sendCancellationEmail = async ({ name, email, event }) => {
    const formattedDate = new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const icsCancel = buildCancelICS({ eventId: event.event_id, title: event.title });

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
        attachments: [{ filename: 'cancel.ics', content: icsCancel, contentType: 'text/calendar; method=CANCEL; charset=UTF-8', contentDisposition: 'attachment' }],
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

module.exports = { transporter, sendInviteEmail, sendCancellationEmail, sendRemovalEmail };
