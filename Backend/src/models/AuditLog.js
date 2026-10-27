const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
