const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Screening = require('../models/Screening');
const scoringEngine = require('../services/scoringEngine');
const { screenAndSave } = require('../services/screeningService');
const { ApiError, asyncHandler, ok, requireObjectId, ownerFilter, parsePaging, audit } = require('../utils/helpers');

/** POST /api/screen  { candidateId, jobId, weights? } */
exports.screen = asyncHandler(async (req, res) => {
  const candidateId = requireObjectId(req.body.candidateId, 'candidateId');
  const jobId = requireObjectId(req.body.jobId, 'jobId');
  let weights;
  try { weights = scoringEngine.resolveWeights(req.body.weights); } catch (e) { throw new ApiError(400, e.message); }

  const [candidate, job] = await Promise.all([
    Candidate.findOne({ _id: candidateId, ...ownerFilter(req) }),
    Job.findOne({ _id: jobId, ...ownerFilter(req) })
  ]);
  if (!candidate) throw new ApiError(404, 'Candidate not found');
  if (!job) throw new ApiError(404, 'Job not found');

  const { screening, result } = await screenAndSave({ candidate, job, weights, userId: req.user.id });
  await audit(req, 'SCREENING_COMPLETED', { candidate: candidate._id, job: job._id, metadata: { overallScore: screening.overallScore } });
  ok(res, { ...screening.toObject(), id: String(screening._id), notes: result.notes, explanation: result.explanation }, 201);
});

/** GET /api/screen?candidateId=&jobId=  screening history (newest first) */
exports.history = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query, 20);
  const filter = req.user.role === 'admin' ? {} : { createdBy: req.user.id };
  if (req.query.candidateId) filter.candidate = requireObjectId(req.query.candidateId, 'candidateId');
  if (req.query.jobId) filter.job = requireObjectId(req.query.jobId, 'jobId');
  const [items, total] = await Promise.all([
    Screening.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Screening.countDocuments(filter)
  ]);
  ok(res, items, 200, { meta: { total, page, limit } });
});
