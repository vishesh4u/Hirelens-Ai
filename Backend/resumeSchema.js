/**
 * Validation + grounding for AI-extracted resume data.
 *
 * The model's JSON is untrusted input:
 *   1. validateAiExtraction()  - strict shape/type check; unknown keys are dropped (so an injected {"score": 100} goes nowhere).
 *   2. groundExtraction()      - every value must be verifiable in the resume text itself. Anything the model "inferred" or
 *                                invented (an employer, a skill, a date, a URL...) is removed. What remains is information that is
 *                                explicitly stated in the document; the model only helped to structure it.
 * Hand-written (no extra dependency) so it also runs in environments where `npm install` is not possible.
 */
const { normalizeSkill, normalizeSkills, findSkillsInText } = require('./skillNormalizer');

const ALLOWED_KEYS = ['name', 'email', 'phone', 'location', 'summary', 'links', 'skills', 'education', 'experience', 'projects', 'certifications', 'achievements', 'publications'];

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const objects = (v, max) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).slice(0, max) : []);
const strings = (v, maxItems, maxLen) => (Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : []);
const year = (v) => { const s = str(v, 4); return /^(?:19|20)\d{2}$/.test(s) ? s : ''; };

/** @returns {{ ok: boolean, value: object|null, issues: string[] }} */
function validateAiExtraction(raw) {
  const issues = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, value: null, issues: ['The AI response was not a JSON object.'] };
  const extra = Object.keys(raw).filter((k) => !ALLOWED_KEYS.includes(k));
  if (extra.length) issues.push(`Ignored unexpected field(s) in the AI response: ${extra.slice(0, 5).join(', ')}.`);
  const links = raw.links && typeof raw.links === 'object' && !Array.isArray(raw.links) ? raw.links : {};
  const value = {
    name: str(raw.name, 150),
    email: str(raw.email, 254).toLowerCase(),
    phone: str(raw.phone, 40),
    location: str(raw.location, 150),
    summary: str(raw.summary, 700),
    links: { linkedin: str(links.linkedin, 300), github: str(links.github, 300), portfolio: str(links.portfolio, 300) },
    skills: strings(raw.skills, 80, 50),
    education: objects(raw.education, 6).map((e) => ({ degree: str(e.degree, 100), field: str(e.field, 120), institution: str(e.institution, 150), startYear: year(e.startYear), endYear: year(e.endYear), grade: str(e.grade, 30) })).filter((e) => e.degree || e.institution),
    experience: objects(raw.experience, 15).map((e) => ({
      employer: str(e.employer || e.company, 120), title: str(e.title || e.role, 120), startDate: str(e.startDate, 30), endDate: str(e.endDate, 30),
      type: e.type === 'internship' ? 'internship' : '', responsibilities: strings(e.responsibilities, 12, 300), achievements: strings(e.achievements, 8, 300)
    })).filter((e) => e.employer || e.title),
    projects: objects(raw.projects, 15).map((p) => ({ name: str(p.name, 150), description: str(p.description, 800), technologies: strings(p.technologies, 20, 50), contribution: str(p.contribution, 400), links: strings(p.links, 5, 300) })).filter((p) => p.name),
    certifications: strings(raw.certifications, 15, 200),
    achievements: strings(raw.achievements, 12, 300),
    publications: strings(raw.publications, 10, 300)
  };
  return { ok: true, value, issues };
}

/* ------------------------------ grounding ------------------------------ */
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const tokensOf = (s) => (String(s || '').toLowerCase().match(/[a-z0-9+#.]+/g) || []).map((t) => t.replace(/^\.+|\.+$/g, '')).filter((t) => t.length > 1);

function makeChecker(text) {
  const T = norm(text), digits = String(text).replace(/\D/g, ''), tokenSet = new Set(tokensOf(text)), found = new Set(findSkillsInText(text));
  const has = (s) => Boolean(s) && T.includes(norm(s));
  const mostly = (s, threshold) => { const t = tokensOf(s); return t.length > 0 && t.filter((x) => tokenSet.has(x)).length / t.length >= threshold; };
  return {
    has, mostly,
    phone: (p) => { const d = String(p).replace(/\D/g, ''); return d.length >= 8 && digits.includes(d); },
    url: (u) => has(String(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')),
    skill: (s) => { const n = normalizeSkill(s); return has(s) || has(n) || found.has(n); },
    yearIn: (d) => { const y = String(d || '').match(/(?:19|20)\d{2}/g); return !y || y.every((v) => T.includes(v)); }, // dates without a year (e.g. "Present") pass
    grade: (g) => { const nums = String(g).match(/\d+(?:\.\d+)?/g); return Boolean(nums) && nums.every((n) => T.includes(n)); } // every number in the grade must be written in the resume
  };
}

/**
 * Removes everything that cannot be verified in `text`.
 * @returns {{ value: object, ignored: number }} ignored = how many AI-suggested items were discarded
 */
function groundExtraction(v, text) {
  const c = makeChecker(text); let ignored = 0;
  const keep = (ok) => { if (!ok) ignored += 1; return ok; };
  const out = {
    name: keep(!v.name || c.has(v.name)) ? v.name : '',
    email: keep(!v.email || c.has(v.email)) ? v.email : '',
    phone: keep(!v.phone || c.phone(v.phone)) ? v.phone : '',
    location: keep(!v.location || c.has(v.location)) ? v.location : '',
    summary: keep(!v.summary || c.mostly(v.summary, 0.8)) ? v.summary : '', // an AI-written summary is an interpretation, not a stated fact
    links: {},
    skills: normalizeSkills(v.skills.filter((s) => keep(c.skill(s)))),
    education: v.education.map((e) => ({
      degree: keep(!e.degree || c.mostly(e.degree, 0.5)) ? e.degree : '', field: keep(!e.field || c.mostly(e.field, 0.7)) ? e.field : '',
      institution: keep(!e.institution || c.has(e.institution)) ? e.institution : '',
      startYear: keep(!e.startYear || c.yearIn(e.startYear)) ? e.startYear : '', endYear: keep(!e.endYear || c.yearIn(e.endYear)) ? e.endYear : '', grade: keep(!e.grade || c.grade(e.grade)) ? e.grade : ''
    })).filter((e) => e.degree || e.institution),
    experience: v.experience.map((e) => ({
      employer: keep(!e.employer || c.has(e.employer)) ? e.employer : '', title: keep(!e.title || c.mostly(e.title, 0.6)) ? e.title : '',
      startDate: keep(!e.startDate || c.yearIn(e.startDate)) ? e.startDate : '', endDate: keep(!e.endDate || c.yearIn(e.endDate)) ? e.endDate : '', type: e.type,
      responsibilities: e.responsibilities.filter((r) => keep(c.mostly(r, 0.6))), achievements: e.achievements.filter((r) => keep(c.mostly(r, 0.6)))
    })).filter((e) => e.employer || e.title),
    projects: v.projects.map((p) => ({
      name: keep(c.mostly(p.name, 0.8)) ? p.name : '', description: keep(!p.description || c.mostly(p.description, 0.5)) ? p.description : '',
      technologies: p.technologies.filter((t) => keep(c.skill(t))), contribution: keep(!p.contribution || c.mostly(p.contribution, 0.5)) ? p.contribution : '', links: p.links.filter((u) => keep(c.url(u)))
    })).filter((p) => p.name),
    certifications: v.certifications.filter((x) => keep(c.mostly(x, 0.8))),
    achievements: v.achievements.filter((x) => keep(c.mostly(x, 0.8))),
    publications: v.publications.filter((x) => keep(c.mostly(x, 0.8)))
  };
  ['linkedin', 'github', 'portfolio'].forEach((k) => { out.links[k] = keep(!v.links[k] || c.url(v.links[k])) ? v.links[k] : ''; });
  return { value: out, ignored };
}

/** Phrases that read like instructions to an AI. Their presence does not change processing (the text is always data); it only raises a warning. */
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?)/i,
  /disregard\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier|instructions?)/i,
  /(?:system\s+prompt|developer\s+message|as\s+an\s+ai\s+(?:language\s+)?model)/i,
  /(?:rate|score|rank|mark)\s+(?:this\s+)?(?:candidate|resume|applicant)\s+(?:as\s+)?(?:\d+|perfect|highest|top|excellent)/i,
  /(?:override|bypass)\s+.{0,25}(?:instructions?|rules?|screening|filters?)/i,
  /you\s+(?:must|should)\s+(?:now\s+)?(?:recommend|hire|select|shortlist)/i
];
const looksLikeInjection = (text) => INJECTION_PATTERNS.some((rx) => rx.test(String(text || '')));

module.exports = { validateAiExtraction, groundExtraction, looksLikeInjection, ALLOWED_KEYS, norm, tokensOf };
