/** Orchestrates scoring + AI wording + persistence. Scoring itself stays in scoringEngine. */
const Screening = require('../models/Screening');
const scoringEngine = require('./scoringEngine');
const aiService = require('./aiService');
const { normalizeSkills } = require('./skillNormalizer');

const candidateText = (c) => [normalizeSkills(c.skills).join(' '),
  ...(c.projects || []).map((p) => `${p.name} ${p.desc} ${(p.tech || []).join(' ')}`),
  ...(c.experience || []).map((e) => `${e.role} ${e.summary}`)].join(' ');
const jobText = (j) => [j.title, j.description, (j.requiredSkills || []).join(' '), (j.preferredSkills || []).join(' ')].join(' ');

/** Pure scoring for plain objects (optionally refined by embeddings). Never throws for AI problems. */
async function scoreWithOptionalEmbeddings(candidate, job, weights) {
  const embeddingSim = await aiService.embeddingSimilarity(candidateText(candidate), jobText(job));
  return scoringEngine.scoreCandidate(candidate, job, weights, embeddingSim == null ? {} : { embeddingSimilarity: embeddingSim });
}

async function screenAndSave({ candidate, job, weights, userId }) {
  const c = candidate.toObject ? candidate.toObject() : candidate;
  const j = job.toObject ? job.toObject() : job;
  const result = await scoreWithOptionalEmbeddings(c, j, weights);
  const summary = await aiService.generateSummary(c, j, result);
  const doc = await Screening.create({
    candidate: c._id, job: j._id,
    overallScore: result.overallScore, skillsScore: result.skillsScore, experienceScore: result.experienceScore,
    semanticScore: result.semanticScore, educationScore: result.educationScore, projectsScore: result.projectsScore,
    matchedSkills: result.matchedSkills, partialSkills: result.partialSkills, missingSkills: result.missingSkills,
    strengths: result.strengths, gaps: result.gaps, evidence: result.evidence,
    summary: summary.text, summarySource: summary.source, semanticMethod: result.semanticMethod,
    scoringWeights: result.scoringWeights, createdBy: userId
  });
  return { screening: doc, result };
}

/** Latest screening per (candidate, job) matching `match`. */
async function latestScreenings(match = {}) {
  return Screening.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $group: { _id: { candidate: '$candidate', job: '$job' }, doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } }
  ]);
}

module.exports = { screenAndSave, latestScreenings, scoreWithOptionalEmbeddings };
