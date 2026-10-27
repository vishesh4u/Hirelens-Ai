const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Screening = require('../models/Screening');
const { normalizeSkill, normalizeSkills } = require('../services/skillNormalizer');
const { parseResumeFile } = require('../services/resumeParser');
const { scoreWithOptionalEmbeddings, latestScreenings } = require('../services/screeningService');
const scoringEngine = require('../services/scoringEngine');
const { ApiError, asyncHandler, ok, isObjectId, requireObjectId, toStringArray, cleanStr, ownerFilter, parsePaging, escapeRegex, audit } = require('../utils/helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    out.experience = b[k].slice(0, 30).map((e) => ({ role: cleanStr(e.role, 150), company: cleanStr(e.company, 150), years: Math.max(0, Math.min(60, Number(e.years) || 0)), summary: cleanStr(e.summary, 1000) }));
  }
  if ((k = has('projects'))) {
    if (!Array.isArray(b[k])) throw new ApiError(400, 'projects must be an array');
    out.projects = b[k].slice(0, 30).map((p) => ({ name: cleanStr(p.name, 200), desc: cleanStr(p.desc, 1000), tech: normalizeSkills(toStringArray(p.tech)) }));
  }
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

exports.get = asyncHandler(async (req, res) => ok(res, await findOwnedCandidate(req, true)));

exports.create = asyncHandler(async (req, res) => {
  const fields = pickCandidateFields(req.body, false);
  await assertOwnsJob(req, fields.job);
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

/** multipart: resume (PDF/DOCX) + optional name/email/phone/location/job overrides. File is parsed in memory, not stored. */
exports.upload = asyncHandler(async (req, res) => {
  const jobId = req.body.job || req.body.jobId;
  if (jobId) { requireObjectId(String(jobId), 'job id'); await assertOwnsJob(req, jobId); }
  const { parsed, meta } = await parseResumeFile(req.file);
  const warnings = [];
  const name = cleanStr(req.body.name, 150) || parsed.name || (warnings.push('Name could not be extracted; using the file name. Please correct it.'), meta.originalName.replace(/\.[^.]+$/, ''));
  if (!parsed.email) warnings.push('No email address found.');
  if (!parsed.skills.length) warnings.push('No skills detected; review the resume text.');
  const c = await Candidate.create({
    name, email: cleanStr(req.body.email, 254).toLowerCase() || parsed.email, phone: cleanStr(req.body.phone, 40) || parsed.phone,
    location: cleanStr(req.body.location, 150), skills: parsed.skills, education: parsed.education, experience: parsed.experience,
    projects: parsed.projects, certifications: parsed.certifications, resumeText: parsed.resumeText, resumeFile: meta,
    job: jobId || undefined, createdBy: req.user.id
  });
  await audit(req, 'RESUME_UPLOADED', { candidate: c._id, job: c.job, metadata: { file: meta.originalName, size: meta.size } });
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
