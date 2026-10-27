/**
 * Resume text extraction + deterministic structured parsing.
 * Nothing is invented: fields that cannot be found are left empty and the raw text is always kept.
 * Protected attributes (gender, religion, caste, age, marital status, photo) are deliberately not extracted.
 */
const path = require('path');
const { normalizeSkill, normalizeSkills, findSkillsInText } = require('./skillNormalizer');

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream']
};

class ResumeError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.expose = true; }
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || '')).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
  return base || 'resume';
}

/** Validates filename, size, extension, mime type and magic bytes. Returns the normalized extension. */
function validateUpload(file) {
  if (!file || !file.buffer) throw new ResumeError('No resume file uploaded (field name: "resume")');
  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  if (!ALLOWED[ext]) throw new ResumeError('Unsupported file type. Upload a PDF or DOCX resume.', 415);
  if (!ALLOWED[ext].includes(file.mimetype)) throw new ResumeError('File content type does not match its extension.', 415);
  if (file.size > MAX_BYTES || file.buffer.length > MAX_BYTES) throw new ResumeError('File too large (maximum 5 MB).', 413);
  if (!file.buffer.length) throw new ResumeError('The uploaded file is empty.');
  const head = file.buffer.subarray(0, 5).toString('latin1');
  if (ext === '.pdf' && !head.startsWith('%PDF-')) throw new ResumeError('File is not a valid PDF.', 415);
  if (ext === '.docx' && !head.startsWith('PK')) throw new ResumeError('File is not a valid DOCX.', 415);
  return ext;
}

async function extractText(buffer, ext) {
  try {
    let text = '';
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // avoids pdf-parse's debug-mode index.js
      text = (await pdfParse(buffer)).text;
    } else {
      text = (await require('mammoth').extractRawText({ buffer })).value;
    }
    text = String(text || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw new ResumeError('No readable text found (scanned/image-only resumes are not supported).', 422);
    return text;
  } catch (err) {
    if (err instanceof ResumeError) throw err;
    throw new ResumeError('Could not read this file. It may be corrupted or password protected.', 422);
  }
}

/* ------------------------------ structured parsing ------------------------------ */
const HEADINGS = {
  skills: /^(technical |key |core )?(skills?|competencies|technologies|tech stack)( (&|and) tools)?$/i,
  education: /^(education|academic (background|qualifications?)|qualifications?)( (&|and) training)?$/i,
  experience: /^((work|professional|relevant|industry) )?(experience|employment( history)?|work history)$/i,
  projects: /^((academic|personal|key|selected) )?projects?$/i,
  certifications: /^(certifications?|licenses?( (&|and) certifications?)?|courses|certificates?)( (&|and) courses)?$/i,
  other: /^(summary|profile|objective|about( me)?|career objective|professional summary|interests|hobbies|languages|references|achievements|awards)$/i
};

function splitSections(text) {
  const sections = { header: [] };
  let current = 'header';
  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const label = line.replace(/[:\-–—_*#|]+$/g, '').replace(/^[#*\s]+/, '').trim();
    if (label.length <= 40) {
      const key = Object.keys(HEADINGS).find((k) => HEADINGS[k].test(label));
      if (key) { current = key; sections[current] = sections[current] || []; return; }
    }
    (sections[current] = sections[current] || []).push(line);
  });
  return sections;
}

const BULLET = /^[\s•●▪◦○*\-–—·]+/;
const stripBullet = (l) => l.replace(BULLET, '').trim();
const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(?:((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})|(present|current|now|ongoing))/i;

function extractName(headerLines, all) {
  const candidates = (headerLines.length ? headerLines : all).slice(0, 6);
  for (const l of candidates) {
    if (/[@\d/:]|http|www\.|resume|curriculum|vitae/i.test(l)) continue;
    const words = l.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && l.length <= 50 && words.every((w) => /^[A-Za-z][A-Za-z.'’-]*$/.test(w))) {
      return words.map((w) => (w === w.toUpperCase() && w.length > 2 ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(' ');
    }
  }
  return '';
}

function extractPhone(text) {
  const matches = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{2,4})?/g) || [];
  for (const m of matches) {
    const digits = m.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15 && !/^(19|20)\d{2}(19|20)\d{2}/.test(digits)) return m.trim();
  }
  return '';
}

function parseSkills(lines, fullText) {
  const listed = [];
  lines.forEach((l) => {
    const body = l.includes(':') ? l.slice(l.indexOf(':') + 1) : l; // drop "Languages:" style labels
    stripBullet(body).split(/[,;|•·●▪\u2022]/).forEach((s) => {
      const t = s.trim().replace(/[.]+$/, '');
      if (t && t.length <= 40 && t.split(/\s+/).length <= 4) listed.push(t);
    });
  });
  return normalizeSkills([...listed, ...findSkillsInText(fullText)]);
}

function parseExperience(lines) {
  const entries = [];
  let cur = null;
  lines.forEach((raw) => {
    const m = raw.match(DATE_RANGE);
    if (m) {
      const startYear = Number(m[2]);
      const endYear = m[4] ? Number(m[4]) : new Date().getFullYear();
      const years = Math.max(0, Math.round((endYear - startYear) * 10) / 10);
      const head = stripBullet(raw.replace(DATE_RANGE, ' ')).replace(/[()\[\]|,–—-]+\s*$/g, '').trim();
      const parts = head.split(/\s+(?:at|@)\s+|\s*[|–—]\s*|\s+-\s+|,\s+/).map((s) => s.trim()).filter(Boolean);
      cur = { role: parts[0] || '', company: parts[1] || '', years, summary: '' };
      entries.push(cur);
    } else if (cur) {
      cur.summary = (cur.summary + ' ' + stripBullet(raw)).trim().slice(0, 600);
    } else if (!DATE_RANGE.test(raw)) {
      cur = { role: stripBullet(raw).slice(0, 100), company: '', years: 0, summary: '' }; // dates unknown: years stay 0
      entries.push(cur);
    }
  });
  return entries.slice(0, 15);
}

function parseProjects(lines) {
  const projects = [];
  let cur = null;
  lines.forEach((raw) => {
    const isBullet = BULLET.test(raw) && raw.length > 3 && /^[\s•●▪◦○*\-–—·]/.test(raw);
    const techLine = raw.match(/^(?:tech(?:nologies)?(?: stack)?|built with|tools|stack)\s*[:\-]\s*(.+)$/i);
    if (techLine && cur) { cur.tech = normalizeSkills([...cur.tech, ...techLine[1].split(/[,;|]/).map((s) => s.trim())]); return; }
    if (!isBullet && raw.length <= 90 && (!cur || cur.desc)) {
      const [name, rest] = stripBullet(raw).split(/\s+[-–—:|]\s+/);
      cur = { name: (name || '').trim(), desc: (rest || '').trim(), tech: [] };
      projects.push(cur);
    } else if (cur) {
      cur.desc = (cur.desc + ' ' + stripBullet(raw)).trim().slice(0, 600);
    }
  });
  projects.forEach((p) => { p.tech = normalizeSkills([...p.tech, ...findSkillsInText(`${p.name} ${p.desc}`)]); });
  return projects.filter((p) => p.name).slice(0, 15);
}

const DEGREE_LINE = /(ph\.?d|m\.?\s?tech|m\.?\s?sc|master|mba|mca|b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|bca|bachelor|diploma)/i;

/** Deterministic parse of resume text into the Candidate shape. */
function parseResumeText(rawText) {
  const text = String(rawText || '');
  const sections = splitSections(text);
  const allLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const email = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [''])[0].toLowerCase();

  let education = (sections.education || []).map(stripBullet).filter((l) => l.length > 3);
  if (!education.length) education = allLines.filter((l) => DEGREE_LINE.test(l) && l.length < 160).map(stripBullet);

  return {
    name: extractName(sections.header || [], allLines),
    email,
    phone: extractPhone(text),
    skills: parseSkills(sections.skills || [], text),
    education: education.slice(0, 8),
    experience: parseExperience(sections.experience || []),
    projects: parseProjects(sections.projects || []),
    certifications: (sections.certifications || []).map(stripBullet).filter((l) => l.length > 2).slice(0, 15),
    resumeText: text
  };
}

async function parseResumeFile(file) {
  const ext = validateUpload(file);
  const text = await extractText(file.buffer, ext);
  return { parsed: parseResumeText(text), meta: { originalName: sanitizeFilename(file.originalname), mimeType: file.mimetype, size: file.size || file.buffer.length, uploadedAt: new Date() } };
}

module.exports = { parseResumeFile, parseResumeText, validateUpload, sanitizeFilename, ResumeError, MAX_BYTES };
