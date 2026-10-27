const mongoose = require('mongoose');

const STATUSES = ['New', 'Under Review', 'Shortlisted', 'Rejected', 'Interview', 'Hired'];

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Candidate name is required'], trim: true, maxlength: 150 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  location: { type: String, trim: true, maxlength: 150, default: '' },
  skills: { type: [String], default: [] },
  education: { type: [String], default: [] },
  experience: {
    type: [new mongoose.Schema({ role: String, company: String, years: { type: Number, min: 0, default: 0 }, summary: String }, { _id: false })],
    default: []
  },
  projects: {
    type: [new mongoose.Schema({ name: String, desc: String, tech: [String] }, { _id: false })],
    default: []
  },
  certifications: { type: [String], default: [] },
  resumeText: { type: String, select: false, maxlength: 200000 },
  // Metadata only: uploaded files are parsed in memory and not stored (see README).
  resumeFile: {
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedAt: Date
  },
  status: { type: String, enum: STATUSES, default: 'New' },
  notes: { type: String, maxlength: 5000, default: '' },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', index: true }, // job applied for
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });

candidateSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
