import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import formidable from 'formidable';
import { put } from '@vercel/blob';
import { Resend } from 'resend';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ENQUIRY_RECIPIENT = 'hoodadaksh2003@gmail.com';
const FROM_ADDRESS = 'Havenmodular <onboarding@resend.dev>';
const FILE_FIELD_NAMES = new Set(['photos', 'gardenPhotos', 'sitePhotos', 'sketch', 'sketchFile']);
const PHOTO_FIELD_NAMES = new Set(['photos', 'gardenPhotos', 'sitePhotos']);
const SKETCH_FIELD_NAMES = new Set(['sketch', 'sketchFile']);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function clean(value, maxLength = 2000) {
  const first = Array.isArray(value) ? value[0] : value;
  return String(first || '').trim().slice(0, maxLength);
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

function fileArray(files, names) {
  return Object.entries(files || {})
    .filter(([field]) => names.has(field))
    .flatMap(([, value]) => Array.isArray(value) ? value : [value])
    .filter(file => file && file.size > 0);
}

function safeSegment(value, fallback = 'file') {
  return String(value || fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function parseMultipart(req) {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 12 * 1024 * 1024,
    maxTotalFileSize: 60 * 1024 * 1024,
    filter: part => {
      if (!part.mimetype) return true;
      if (!FILE_FIELD_NAMES.has(part.name)) return false;
      return part.mimetype.startsWith('image/') || part.mimetype === 'application/pdf';
    },
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

async function uploadFiles(files, lead, folderName) {
  const uploaded = [];

  for (const [index, file] of files.entries()) {
    const originalName = safeSegment(file.originalFilename || file.newFilename || `upload-${index + 1}`);
    const pathname = `leads/${folderName}/${originalName}`;
    const stream = createReadStream(file.filepath);

    const blob = await put(pathname, stream, {
      access: 'public',
      contentType: file.mimetype || 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    uploaded.push({
      name: file.originalFilename || originalName,
      url: blob.url,
    });

    try {
      await unlink(file.filepath);
    } catch {
      // Temporary upload cleanup is best effort on serverless storage.
    }
  }

  return uploaded;
}

function fileLinksHtml(files, emptyMessage, label) {
  if (!files.length) return `<p>${escapeHtml(emptyMessage)}</p>`;
  return `
    <ol>
      ${files.map(file => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(label)}: ${escapeHtml(file.name)}</a></li>`).join('')}
    </ol>
  `;
}

function fileLinksText(files, emptyMessage, label) {
  if (!files.length) return emptyMessage;
  return files.map((file, index) => `${index + 1}. ${label}: ${file.url}`).join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return sendJson(res, 500, { error: 'Email service is not configured' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sendJson(res, 500, { error: 'File upload service is not configured' });
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid multipart form data' });
  }

  const { fields, files } = parsed;
  const lead = {
    name: clean(fields.name, 120),
    email: clean(fields.email, 180),
    phone: clean(fields.phone, 80),
    eircode: clean(fields.eircode, 40),
    county: clean(fields.county, 80),
    product: clean(fields.product, 160) || '45 sqm two-bedroom modular garden home',
    use: clean(fields.use, 160),
    owner: clean(fields.owner, 80),
    garden: clean(fields.garden, 120),
    access: clean(fields.access, 80),
    accessWidth: clean(fields.accessWidth, 80),
    slope: clean(fields.slope, 80),
    water: clean(fields.water, 80),
    drainage: clean(fields.drainage, 80),
    elec: clean(fields.elec, 80),
    timeline: clean(fields.timeline, 120),
    budget: clean(fields.budget, 120),
    notes: clean(fields.notes, 4000),
  };

  if (!lead.name) return sendJson(res, 400, { error: 'Name is required' });
  if (!lead.email && !lead.phone) return sendJson(res, 400, { error: 'Email or phone is required' });
  if (!lead.notes) return sendJson(res, 400, { error: 'Message is required' });

  const timestamp = Date.now();
  const folderName = `${timestamp}-${safeSegment(lead.name || lead.email || 'enquiry', 'enquiry')}`;
  const photoFiles = fileArray(files, PHOTO_FIELD_NAMES);
  const sketchFiles = fileArray(files, SKETCH_FIELD_NAMES);
  let uploadedPhotos = [];
  let uploadedSketches = [];

  try {
    uploadedPhotos = await uploadFiles(photoFiles, lead, folderName);
    uploadedSketches = await uploadFiles(sketchFiles, lead, folderName);
  } catch {
    return sendJson(res, 502, { error: 'Failed to upload enquiry files' });
  }

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
      </table>
      <h2 style="font-size:18px;margin:24px 0 8px;">Uploaded Garden Photos</h2>
      ${fileLinksHtml(uploadedPhotos, 'No garden photos were uploaded with this enquiry.', 'View photo')}
      <h2 style="font-size:18px;margin:24px 0 8px;">Sketch / Site Plan</h2>
      ${fileLinksHtml(uploadedSketches, 'No sketch or site plan was uploaded with this enquiry.', 'View sketch')}
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
    '',
    'Uploaded Garden Photos:',
    fileLinksText(uploadedPhotos, 'No garden photos were uploaded with this enquiry.', 'View photo'),
    '',
    'Sketch / Site Plan:',
    fileLinksText(uploadedSketches, 'No sketch or site plan was uploaded with this enquiry.', 'View sketch'),
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

    return sendJson(res, 200, {
      ok: true,
      id: data?.id,
      uploadedPhotos: uploadedPhotos.map(file => file.url),
      uploadedSketches: uploadedSketches.map(file => file.url),
    });
  } catch {
    return sendJson(res, 502, { error: 'Failed to send email' });
  }
}
