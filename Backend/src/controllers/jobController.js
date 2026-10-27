const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Screening = require('../models/Screening');
const { normalizeSkills } = require('../services/skillNormalizer');
const { analyzeJob } = require('../services/jobAnalyzer');
const scoringEngine = require('../services/scoringEngine');
const { latestScreenings } = require('../services/screeningService');
const { ApiError, asyncHandler, ok, requireObjectId, toStringArray, cleanStr, ownerFilter, parsePaging, escapeRegex, audit } = require('../utils/helpers');

const STATUS = ['Open', 'Closed', 'Draft'];

/** Whitelist fields (no mass assignment). Also accepts the frontend's short names (req/pref/exp/edu/desc). */
function pickJobFields(b, partial) {
  const out = {};
  const has = (...keys) => keys.find((k) => b[k] !== undefined);
  let k;
  if ((k = has('title'))) out.title = cleanStr(b[k], 200);
  if ((k = has('company'))) out.company = cleanStr(b[k], 200);
  if ((k = has('location'))) out.location = cleanStr(b[k], 200);
  if ((k = has('description', 'desc'))) out.description = cleanStr(b[k], 20000);
  if ((k = has('requiredSkills', 'req'))) out.requiredSkills = normalizeSkills(toStringArray(b[k]));
  if ((k = has('preferredSkills', 'pref'))) out.preferredSkills = normalizeSkills(toStringArray(b[k]));
  if ((k = has('experience', 'exp'))) {
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < 0 || n > 60) throw new ApiError(400, 'experience must be a number of years between 0 and 60');
    out.experience = n;
  }
  if ((k = has('education', 'edu'))) out.education = cleanStr(b[k], 200);
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) throw new ApiError(400, `status must be one of: ${STATUS.join(', ')}`);
    out.status = b.status;
  }
  if (!partial && !out.title) throw new ApiError(400, 'Job title is required');
  if (partial && out.title === '') throw new ApiError(400, 'Job title cannot be empty');
  return out;
}

async function findOwnedJob(req) {
  const job = await Job.findOne({ _id: requireObjectId(req.params.id, 'job id'), ...ownerFilter(req) });
  if (!job) throw new ApiError(404, 'Job not found');
  return job;
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = { ...ownerFilter(req) };
  if (STATUS.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.search) filter.title = new RegExp(escapeRegex(cleanStr(req.query.search, 100)), 'i');
  const [jobs, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter)
  ]);
  ok(res, jobs, 200, { meta: { total, page, limit } });
});

exports.get = asyncHandler(async (req, res) => ok(res, await findOwnedJob(req)));

exports.create = asyncHandler(async (req, res) => {
  const fields = pickJobFields(req.body, false);
  // Fill requirements from the description when the recruiter did not list any (deterministic, AI-enhanced if configured).
  if (fields.description && !(fields.requiredSkills && fields.requiredSkills.length)) {
    const a = await analyzeJob(fields.description);
    fields.analysis = a;
    fields.requiredSkills = a.requiredSkills;
    if (!(fields.preferredSkills && fields.preferredSkills.length)) fields.preferredSkills = a.preferredSkills;
    if (fields.experience === undefined) fields.experience = a.experience.years;
    if (fields.education === undefined && a.education !== 'Not specified') fields.education = a.education;
  }
  const job = await Job.create({ ...fields, createdBy: req.user.id });
  await audit(req, 'JOB_CREATED', { job: job._id, metadata: { title: job.title } });
  ok(res, job, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const job = await findOwnedJob(req);
  job.set(pickJobFields(req.body, true));
  await job.save();
  await audit(req, 'JOB_UPDATED', { job: job._id });
  ok(res, job);
});

exports.remove = asyncHandler(async (req, res) => {
  const job = await findOwnedJob(req);
  await Promise.all([
    Screening.deleteMany({ job: job._id }),
    Candidate.updateMany({ job: job._id }, { $unset: { job: 1 } }),
    job.deleteOne()
  ]);
  await audit(req, 'JOB_DELETED', { metadata: { jobId: String(job._id), title: job.title } });
  ok(res, { deleted: true });
});

exports.analyze = asyncHandler(async (req, res) => {
  const job = await findOwnedJob(req);
  const analysis = await analyzeJob(job.description);
  job.analysis = analysis;
  await job.save();
  await audit(req, 'JOB_ANALYZED', { job: job._id, metadata: { source: analysis.source } });
  ok(res, analysis);
});

/** Rows built from latest saved screenings for this job. */
async function rankingRows(job, req) {
  const shots = await latestScreenings({ job: job._id });
  const candidates = await Candidate.find({ _id: { $in: shots.map((s) => s.candidate) }, ...ownerFilter(req) }).select('name email status skills');
  const byId = new Map(candidates.map((c) => [String(c._id), c]));
  return shots.filter((s) => byId.has(String(s.candidate))).map((s) => {
    const c = byId.get(String(s.candidate));
    return {
      candidateId: String(c._id), name: c.name, email: c.email, status: c.status,
      overallScore: s.overallScore, skillsScore: s.skillsScore, experienceScore: s.experienceScore,
      semanticScore: s.semanticScore, educationScore: s.educationScore, projectsScore: s.projectsScore,
      matchedSkills: s.matchedSkills, missingSkills: s.missingSkills, screeningId: String(s._id), screenedAt: s.createdAt
    };
  });
}

exports.ranking = asyncHandler(async (req, res) => {
  const job = await findOwnedJob(req);
  const sort = req.query.sort || 'score';
  if (!['score', 'skills', 'experience', 'relevance', 'status'].includes(sort)) throw new ApiError(400, 'sort must be one of: score, skills, experience, relevance, status');
  const rows = scoringEngine.rankRows(await rankingRows(job, req), sort);
  ok(res, rows, 200, { meta: { jobId: String(job._id), sort, total: rows.length } });
});

exports.simulate = asyncHandler(async (req, res) => {
  const job = await findOwnedJob(req);
  let sim;
  try {
    sim = scoringEngine.simulateRanking(await rankingRows(job, req), req.body.weights);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
  // Decision support only: saved screening results are not modified.
  ok(res, sim, 200, { meta: { jobId: String(job._id), persisted: false } });
});
