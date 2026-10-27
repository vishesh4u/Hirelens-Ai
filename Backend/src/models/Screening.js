const mongoose = require('mongoose');

const screeningSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  overallScore: { type: Number, min: 0, max: 100, required: true },
  skillsScore: Number,
  experienceScore: Number,
  semanticScore: Number,
  educationScore: Number,
  projectsScore: Number,
  matchedSkills: [String],
  partialSkills: [String],
  missingSkills: [String],
  strengths: [String],
  gaps: [String],
  evidence: [String],
  summary: String,
  summarySource: { type: String, enum: ['ai', 'fallback'], default: 'fallback' },
  semanticMethod: { type: String, enum: ['lexical', 'embedding+lexical'], default: 'lexical' },
  scoringWeights: {
    skills: Number, experience: Number, semantic: Number, education: Number, projects: Number
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

screeningSchema.index({ candidate: 1, job: 1, createdAt: -1 });

module.exports = mongoose.models.Screening || mongoose.model('Screening', screeningSchema);
