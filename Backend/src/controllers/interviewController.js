const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Screening = require('../models/Screening');
const scoringEngine = require('../services/scoringEngine');
const aiService = require('../services/aiService');
const { ApiError, asyncHandler, ok, requireObjectId, ownerFilter, audit } = require('../utils/helpers');

/** POST /api/interview/questions { candidateId, jobId } -> { technical, behavioral, project, followUp, source } */
exports.questions = asyncHandler(async (req, res) => {
  const [candidate, job] = await Promise.all([
    Candidate.findOne({ _id: requireObjectId(req.body.candidateId, 'candidateId'), ...ownerFilter(req) }),
    Job.findOne({ _id: requireObjectId(req.body.jobId, 'jobId'), ...ownerFilter(req) })
  ]);
  if (!candidate) throw new ApiError(404, 'Candidate not found');
  if (!job) throw new ApiError(404, 'Job not found');

  // Recompute gaps from current data (reusing the weights of the latest saved screening, if any).
  const last = await Screening.findOne({ candidate: candidate._id, job: job._id }).sort({ createdAt: -1 });
  const result = scoringEngine.scoreCandidate(candidate.toObject(), job.toObject(), last ? last.toObject().scoringWeights : undefined);
  const out = await aiService.generateInterviewQuestions(candidate.toObject(), job.toObject(), result);
  await audit(req, 'INTERVIEW_QUESTIONS_GENERATED', { candidate: candidate._id, job: job._id, metadata: { source: out.source } });
  ok(res, out);
});
