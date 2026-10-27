const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Screening = require('../models/Screening');
const { normalizeSkill, normalizeSkills, groupSkills } = require('../services/skillNormalizer');
const { parseResumeFile, validateUpload } = require('../services/resumeParser');
const { scoreWithOptionalEmbeddings, latestScreenings } = require('../services/screeningService');
const scoringEngine = require('../services/scoringEngine');
const { ApiError, asyncHandler, ok, isObjectId, requireObjectId, toStringArray, cleanStr, ownerFilter, parsePaging, escapeRegex, audit } = require('../utils/helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Only http(s) URLs are ever stored (blocks javascript:/data: links that could later be rendered as hrefs). */
const safeUrl = (v) => { const t = cleanStr(v, 300); if (!t) return ''; try { const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); return /^https?:$/.test(u.protocol) ? u.toString().replace(/\/$/, '') : ''; } catch (e) { return ''; } };

function pickCandidateFields(b, partial) {
  const out = {};
  const has = (...keys) => keys.find((k) => b[k] !== undefined);
  let k;
  if ((k = has('name'))) out.name = cleanStr(b[k], 150);
  if ((k = has('email'))) {
    out.email = cleanStr(b[k], 254).toLowerCase();
    if (out.email && !EMAIL_RE.test(out.email)) throw new ApiError(400, 'Invalid email address');
  }
  if ((k = has('phone'))) out.phone = cleanStr(b[k], 40);
  if ((k = has('location'))) out.location = cleanStr(b[k], 150);
  if ((k = has('skills'))) out.skills = normalizeSkills(toStringArray(b[k]));
  if ((k = has('education'))) out.education = toStringArray(b[k], 20).map((s) => s.slice(0, 300));
  if ((k = has('certifications', 'certs'))) out.certifications = toStringArray(b[k], 30).map((s) => s.slice(0, 200));
  if ((k = has('experience'))) {
    if (!Array.isArray(b[k])) throw new ApiError(400, 'experience must be an array');
    out.experience = b[k].slice(0, 30).map((e) => ({
      role: cleanStr(e.role, 150), company: cleanStr(e.company, 150), years: Math.max(0, Math.min(60, Number(e.years) || 0)), summary: cleanStr(e.summary, 1000),
      startDate: cleanStr(e.startDate, 30), endDate: cleanStr(e.endDate, 30), type: e.type === 'internship' ? 'internship' : '',
      bullets: toStringArray(e.bullets, 15).map((x) => x.slice(0, 400)), achievements: toStringArray(e.achievements, 10).map((x) => x.slice(0, 400))
    }));
  }
  if ((k = has('projects'))) {
    if (!Array.isArray(b[k])) throw new ApiError(400, 'projects must be an array');
    out.projects = b[k].slice(0, 30).map((p) => ({ name: cleanStr(p.name, 200), desc: cleanStr(p.desc, 1000), tech: normalizeSkills(toStringArray(p.tech)), links: toStringArray(p.links, 5).map((u) => safeUrl(u)).filter(Boolean), bullets: toStringArray(p.bullets, 10).map((x) => x.slice(0, 400)) }));
  }
  if (b.summary !== undefined) out.summary = cleanStr(b.summary, 1000);
  if (b.publications !== undefined) out.publications = toStringArray(b.publications, 15).map((x) => x.slice(0, 300));
  if (b.achievements !== undefined) out.achievements = toStringArray(b.achievements, 20).map((x) => x.slice(0, 300));
  if (b.yearsOfExperience !== undefined) {
    const n = Number(b.yearsOfExperience);
    if (!Number.isFinite(n) || n < 0 || n > 60) throw new ApiError(400, 'yearsOfExperience must be between 0 and 60');
    out.yearsOfExperience = n;
    out.yearsSource = n > 0 ? 'stated' : 'unknown';
  }
  if (b.links !== undefined) {
    const l = b.links && typeof b.links === 'object' ? b.links : {};
    out.links = { linkedin: safeUrl(l.linkedin), github: safeUrl(l.github), portfolio: safeUrl(l.portfolio) };
  }
  if (b.educationDetails !== undefined) {
    if (!Array.isArray(b.educationDetails)) throw new ApiError(400, 'educationDetails must be an array');
    out.educationDetails = b.educationDetails.slice(0, 10).map((e) => ({ degree: cleanStr(e.degree, 100), field: cleanStr(e.field, 120), institution: cleanStr(e.institution, 150), year: cleanStr(e.year, 4), startYear: cleanStr(e.startYear, 4), grade: cleanStr(e.grade, 30) }));
  }
  if (out.skills) out.skillGroups = groupSkills(out.skills); // always derived server-side from the normalized skills
  if (b.notes !== undefined) out.notes = cleanStr(b.notes, 5000);
  if (b.status !== undefined) {
    if (!Candidate.STATUSES.includes(b.status)) throw new ApiError(400, `status must be one of: ${Candidate.STATUSES.join(', ')}`);
    out.status = b.status;
  }
  if (b.job !== undefined || b.jobId !== undefined) {
    const jobId = b.job !== undefined ? b.job : b.jobId;
    out.job = jobId === null || jobId === '' ? undefined : requireObjectId(String(jobId), 'job id');
  }
  if (!partial && !out.name) throw new ApiError(400, 'Candidate name is required');
  if (partial && out.name === '') throw new ApiError(400, 'Candidate name cannot be empty');
  return out;
}

async function assertOwnsJob(req, jobId) {
  if (jobId && !(await Job.exists({ _id: jobId, ...ownerFilter(req) }))) throw new ApiError(404, 'Job not found');
}

/** Same candidate already saved for this job? Matches on the resume file hash or the e-mail address. */
async function findDuplicate(req, { job, email, resumeHash, excludeId }) {
  const or = [];
  if (resumeHash) or.push({ resumeHash });
  if (email) or.push({ email: String(email).toLowerCase() });
  if (!or.length) return null;
  const q = { ...ownerFilter(req), job: job || null, $or: or };
  if (excludeId) q._id = { $ne: excludeId };
  return Candidate.findOne(q).select('_id name');
}
const DUPLICATE_MESSAGE = 'This candidate already exists for this job.';

async function findOwnedCandidate(req, withText = false) {
  const q = Candidate.findOne({ _id: requireObjectId(req.params.id, 'candidate id'), ...ownerFilter(req) });
  const c = await (withText ? q.select('+resumeText') : q);
  if (!c) throw new ApiError(404, 'Candidate not found');
  return c;
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = { ...ownerFilter(req) };
  if (req.query.job) filter.job = requireObjectId(req.query.job, 'job id');
  if (req.query.status) {
    if (!Candidate.STATUSES.includes(req.query.status)) throw new ApiError(400, 'Invalid status filter');
    filter.status = req.query.status;
  }
  if (req.query.skill) {
    const s = cleanStr(req.query.skill, 60);
    filter.skills = { $in: [normalizeSkill(s), new RegExp(escapeRegex(s), 'i')] };
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(cleanStr(req.query.search, 100)), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  // Aggregation pipelines do not auto-cast ids, so cast explicitly.
  const shotMatch = req.query.job ? { job: new mongoose.Types.ObjectId(filter.job) } : {};
  if (req.query.minimumScore !== undefined) {
    const min = Number(req.query.minimumScore);
    if (!Number.isFinite(min) || min < 0 || min > 100) throw new ApiError(400, 'minimumScore must be between 0 and 100');
    const passing = (await latestScreenings(shotMatch)).filter((s) => s.overallScore >= min).map((s) => s.candidate);
    filter._id = { $in: passing };
  }
  const [candidates, total] = await Promise.all([
    Candidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Candidate.countDocuments(filter)
  ]);
  // Annotate with the latest saved score (for the filtered job, else the candidate's own job).
  const shots = await latestScreenings({ candidate: { $in: candidates.map((c) => c._id) }, ...shotMatch });
  const data = candidates.map((c) => {
    const s = shots.filter((x) => String(x.candidate) === String(c._id) && (!c.job || req.query.job || String(x.job) === String(c.job)))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return { ...c, latestScreening: s ? { overallScore: s.overallScore, job: s.job, screenedAt: s.createdAt } : null };
  });
  ok(res, data, 200, { meta: { total, page, limit } });
});

/** GET /api/candidates/upload-config - limits the UI should show (size limit, accepted types, whether AI extraction is on). */
exports.uploadConfig = asyncHandler(async (req, res) => {
  const { getMaxBytes } = require('../services/resumeParser');
  ok(res, { maxBytes: getMaxBytes(), accepts: ['.pdf', '.docx'], aiExtraction: require('../services/resumeAiExtractor').isEnabled() });
});

// The stored resume text is never returned by the API: the structured profile is all the UI needs.
exports.get = asyncHandler(async (req, res) => {
  const c = await findOwnedCandidate(req, false);
  const { resumeText, ...profile } = c.toObject ? c.toObject() : c; // also stripped here, in case the schema default ever changes
  ok(res, profile);
});

exports.create = asyncHandler(async (req, res) => {
  const fields = pickCandidateFields(req.body, false);
  await assertOwnsJob(req, fields.job);
  if (await findDuplicate(req, { job: fields.job, email: fields.email })) throw new ApiError(409, DUPLICATE_MESSAGE);
  const c = await Candidate.create({ ...fields, createdBy: req.user.id });
  await audit(req, 'CANDIDATE_CREATED', { candidate: c._id, job: c.job });
  ok(res, c, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const c = await findOwnedCandidate(req);
  const fields = pickCandidateFields(req.body, true);
  await assertOwnsJob(req, fields.job);
  const previousStatus = c.status;
  c.set(fields);
  await c.save();
  let action = 'CANDIDATE_UPDATED';
  if (fields.status && fields.status !== previousStatus) {
    if (fields.status === 'Shortlisted') action = 'CANDIDATE_SHORTLISTED';
    else if (fields.status === 'Rejected') action = 'CANDIDATE_REJECTED';
  }
  await audit(req, action, { candidate: c._id, job: c.job, metadata: fields.status ? { from: previousStatus, to: fields.status } : undefined });
  ok(res, c);
});

exports.remove = asyncHandler(async (req, res) => {
  const c = await findOwnedCandidate(req);
  await Promise.all([Screening.deleteMany({ candidate: c._id }), c.deleteOne()]);
  await audit(req, 'CANDIDATE_DELETED', { metadata: { candidateId: String(c._id) } });
  ok(res, { deleted: true });
});

/** Fields taken from a parsed resume. Anything the resume did not contain stays empty ("Not specified" in the UI). */
function candidateFieldsFromParsed(p) {
  return {
    name: p.name, email: p.email, phone: p.phone, location: p.location, links: p.links, summary: p.summary,
    skills: p.skills, skillGroups: p.skillGroups, yearsOfExperience: p.yearsOfExperience, yearsSource: p.yearsSource,
    education: p.education, educationDetails: p.educationDetails, experience: p.experience, projects: p.projects,
    certifications: p.certifications, achievements: p.achievements, publications: p.publications || []
  };
}
const truthy = (v) => ['true', '1', 'yes'].includes(String(v).toLowerCase());

/**
 * POST /api/candidates/upload  (multipart: resume + job [+ preview=true] [+ overrides=<json>])
 *  1. the file is validated, 2. a job is required, 3. the real text is extracted and parsed,
 *  4. duplicates are rejected (409), 5. preview=true returns the extraction WITHOUT saving; otherwise the candidate is saved.
 * `overrides` lets the recruiter correct extracted fields on the review screen; they go through the same validation as manual edits.
 * There is no sample/demo data anywhere in this flow: whatever is returned came from the uploaded file or from the recruiter.
 */
exports.upload = asyncHandler(async (req, res) => {
  validateUpload(req.file); // type / MIME / signature / size errors come first (415, 413, 422)
  const jobId = req.body.job || req.body.jobId;
  if (!jobId) throw new ApiError(400, 'Select a job before uploading a resume.');
  requireObjectId(String(jobId), 'job id');
  await assertOwnsJob(req, jobId);

  const { parsed, hash, meta, extraction } = await parseResumeFile(req.file);
  let overrides = {};
  if (req.body.overrides) {
    let raw;
    try { raw = JSON.parse(req.body.overrides); } catch (e) { throw new ApiError(400, 'Invalid overrides JSON'); }
    overrides = pickCandidateFields(raw && typeof raw === 'object' ? raw : {}, true);
    delete overrides.job; delete overrides.status; delete overrides.notes;
  }
  const fields = { ...candidateFieldsFromParsed(parsed), ...overrides };
  if (overrides.education && !overrides.educationDetails) fields.educationDetails = []; // a corrected education list replaces the parsed details

  if (await findDuplicate(req, { job: jobId, email: fields.email, resumeHash: hash })) throw new ApiError(409, DUPLICATE_MESSAGE);

  const warnings = [];
  if (!fields.name) warnings.push('Candidate name could not be read from the resume.');
  if (!fields.email) warnings.push('No email address found.');
  if (!fields.skills.length) warnings.push('No skills detected.');
  if (!fields.education.length) warnings.push('No education details detected.');
  (extraction.warnings || []).forEach((w) => warnings.push(w));

  if (truthy(req.body.preview) || truthy(req.query.preview)) {
    await audit(req, 'RESUME_PARSED', { job: jobId, metadata: { size: meta.size, method: extraction.method } });
    return ok(res, { preview: fields, file: meta, resumeHash: hash, textLength: parsed.resumeText.length, extraction, warnings });
  }
  if (!fields.name) throw new ApiError(422, 'Candidate name could not be read from the resume. Review the extraction and enter the name.');

  const c = await Candidate.create({ ...fields, resumeText: parsed.resumeText, resumeTextStoredAt: new Date(), resumeFile: meta, resumeHash: hash, extraction, job: jobId, createdBy: req.user.id });
  await audit(req, 'RESUME_UPLOADED', { candidate: c._id, job: c.job, metadata: { size: meta.size, method: extraction.method } });
  await audit(req, 'CANDIDATE_CREATED', { candidate: c._id, job: c.job });
  const { resumeText, ...withoutText } = c.toObject();
  ok(res, { candidate: withoutText, warnings }, 201);
});

/** Side-by-side scores for a recruiter to weigh. Fresh deterministic scoring; nothing saved; no "winner" declared. */
exports.compare = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.candidateIds) ? [...new Set(req.body.candidateIds.map(String))] : [];
  if (ids.length < 2 || ids.length > 5) throw new ApiError(400, 'Provide 2 to 5 distinct candidateIds');
  if (!ids.every(isObjectId)) throw new ApiError(400, 'Invalid candidate id in candidateIds');
  const job = await Job.findOne({ _id: requireObjectId(req.body.jobId, 'job id'), ...ownerFilter(req) });
  if (!job) throw new ApiError(404, 'Job not found');
  let weights;
  try { weights = scoringEngine.resolveWeights(req.body.weights); } catch (e) { throw new ApiError(400, e.message); }
  const candidates = await Candidate.find({ _id: { $in: ids }, ...ownerFilter(req) });
  if (candidates.length !== ids.length) throw new ApiError(404, 'One or more candidates not found');
  const byId = new Map(candidates.map((c) => [String(c._id), c]));
  const rows = [];
  for (const id of ids) {
    const c = byId.get(id);
    const r = await scoreWithOptionalEmbeddings(c.toObject(), job.toObject(), weights);
    rows.push({
      candidateId: id, name: c.name, status: c.status,
      overallScore: r.overallScore, skillsScore: r.skillsScore, experienceScore: r.experienceScore,
      semanticScore: r.semanticScore, educationScore: r.educationScore, projectsScore: r.projectsScore,
      matchedSkills: r.matchedSkills, partialSkills: r.partialSkills, missingSkills: r.missingSkills
    });
  }
  ok(res, { jobId: String(job._id), weights, candidates: rows, note: 'Comparison is decision support. No automatic hiring winner is declared.' });
});
