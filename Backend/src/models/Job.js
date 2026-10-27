const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Job title is required'], trim: true, maxlength: 200 },
  company: { type: String, trim: true, maxlength: 200, default: '' },
  location: { type: String, trim: true, maxlength: 200, default: '' },
  description: { type: String, trim: true, maxlength: 20000, default: '' },
  requiredSkills: { type: [String], default: [] },
  preferredSkills: { type: [String], default: [] },
  experience: { type: Number, min: 0, max: 60, default: 0 }, // minimum years required
  education: { type: String, trim: true, maxlength: 200, default: '' },
  status: { type: String, enum: ['Open', 'Closed', 'Draft'], default: 'Open' },
  analysis: { type: mongoose.Schema.Types.Mixed, default: null }, // last jobAnalyzer output
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });

module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema);
