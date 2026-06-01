import { Resend } from 'resend';

const ENQUIRY_RECIPIENT = 'hoodadaksh2003@gmail.com';
const FROM_ADDRESS = 'Havenmodular <onboarding@resend.dev>';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function clean(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value, 6000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 12px;border:1px solid #e5e0d8;font-weight:600;background:#f7f4ef;width:220px;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border:1px solid #e5e0d8;">${escapeHtml(value) || '-'}</td>
    </tr>
  `;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return sendJson(res, 500, { error: 'Email service is not configured' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const lead = {
    name: clean(body.name, 120),
    email: clean(body.email, 180),
    phone: clean(body.phone, 80),
    eircode: clean(body.eircode, 40),
    county: clean(body.county, 80),
    product: clean(body.product, 160) || '45 sqm two-bedroom modular garden home',
    use: clean(body.use, 160),
    owner: clean(body.owner, 80),
    garden: clean(body.garden, 120),
    access: clean(body.access, 80),
    accessWidth: clean(body.accessWidth, 80),
    slope: clean(body.slope, 80),
    water: clean(body.water, 80),
    drainage: clean(body.drainage, 80),
    elec: clean(body.elec, 80),
    timeline: clean(body.timeline, 120),
    budget: clean(body.budget, 120),
    notes: clean(body.notes, 4000),
    photoCount: clean(body.photoCount, 20),
    sketchFile: clean(body.sketchFile, 180),
  };

  if (!lead.name) return sendJson(res, 400, { error: 'Name is required' });
  if (!lead.email && !lead.phone) return sendJson(res, 400, { error: 'Email or phone is required' });
  if (!lead.notes) return sendJson(res, 400, { error: 'Message is required' });

  const location = [lead.eircode, lead.county].filter(Boolean).join(', ');
  const subjectParts = ['New Havenmodular enquiry', lead.name, lead.county].filter(Boolean);
  const subject = subjectParts.join(' - ');
  const submittedAt = new Date().toLocaleString('en-IE', { timeZone: 'Europe/Dublin' });

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1c1c1e;line-height:1.5;">
      <h1 style="font-size:22px;margin:0 0 16px;">New Havenmodular enquiry</h1>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        ${row('Submitted', submittedAt)}
        ${row('Name', lead.name)}
        ${row('Email', lead.email)}
        ${row('Phone', lead.phone)}
        ${row('Location', location)}
        ${row('Preferred modular home / product', lead.product)}
        ${row('Intended use', lead.use)}
        ${row('Message / requirements', lead.notes)}
        ${row('Owns property', lead.owner)}
        ${row('Garden size', lead.garden)}
        ${row('Side access', lead.access)}
        ${row('Access width', lead.accessWidth)}
        ${row('Slope', lead.slope)}
        ${row('Water nearby', lead.water)}
        ${row('Drainage nearby', lead.drainage)}
        ${row('Electricity nearby', lead.elec)}
        ${row('Timeline', lead.timeline)}
        ${row('Budget', lead.budget)}
        ${row('Garden photo count', lead.photoCount)}
        ${row('Site sketch filename', lead.sketchFile)}
      </table>
    </div>
  `;

  const text = [
    'New Havenmodular enquiry',
    '',
    `Submitted: ${submittedAt}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email || '-'}`,
    `Phone: ${lead.phone || '-'}`,
    `Location: ${location || '-'}`,
    `Preferred modular home / product: ${lead.product}`,
    `Intended use: ${lead.use || '-'}`,
    '',
    'Message / requirements:',
    lead.notes,
    '',
    `Owns property: ${lead.owner || '-'}`,
    `Garden size: ${lead.garden || '-'}`,
    `Side access: ${lead.access || '-'}`,
    `Access width: ${lead.accessWidth || '-'}`,
    `Slope: ${lead.slope || '-'}`,
    `Water nearby: ${lead.water || '-'}`,
    `Drainage nearby: ${lead.drainage || '-'}`,
    `Electricity nearby: ${lead.elec || '-'}`,
    `Timeline: ${lead.timeline || '-'}`,
    `Budget: ${lead.budget || '-'}`,
    `Garden photo count: ${lead.photoCount || 0}`,
    `Site sketch filename: ${lead.sketchFile || '-'}`,
  ].join('\n');

  const payload = {
    from: FROM_ADDRESS,
    to: ENQUIRY_RECIPIENT,
    subject,
    html,
    text,
  };

  if (lead.email) payload.reply_to = lead.email;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send(payload);

    if (error) {
      return sendJson(res, 502, { error: 'Failed to send email', details: error });
    }

    return sendJson(res, 200, { ok: true, id: data?.id });
  } catch (error) {
    return sendJson(res, 502, { error: 'Failed to send email' });
  }
};
