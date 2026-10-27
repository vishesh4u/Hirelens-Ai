const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Screening = require('../models/Screening');
const scoringEngine = require('../services/scoringEngine');
const aiService = require('../services/aiService');
const { buildReport } = require('../services/reportService');
const { ApiError, asyncHandler, ok, requireObjectId, ownerFilter, audit } = require('../utils/helpers');

/** GET /api/reports/:candidateId?jobId=...  (jobId defaults to the candidate's job) */
exports.candidateReport = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOne({ _id: requireObjectId(req.params.candidateId, 'candidateId'), ...ownerFilter(req) });
  if (!candidate) throw new ApiError(404, 'Candidate not found');
  const jobId = req.query.jobId || (candidate.job && String(candidate.job));
  if (!jobId) throw new ApiError(400, 'jobId is required (candidate is not linked to a job)');
  const job = await Job.findOne({ _id: requireObjectId(jobId, 'jobId'), ...ownerFilter(req) });
  if (!job) throw new ApiError(404, 'Job not found');

  const saved = await Screening.findOne({ candidate: candidate._id, job: job._id }).sort({ createdAt: -1 });
  const result = scoringEngine.scoreCandidate(candidate.toObject(), job.toObject(), saved ? saved.toObject().scoringWeights : undefined);
  const report = buildReport({ candidate, job, result, savedScreening: saved });
  if (!report.summary) report.summary = aiService.fallbackSummary(candidate, job, result);
  await audit(req, 'REPORT_GENERATED', { candidate: candidate._id, job: job._id });
  ok(res, report);
});
