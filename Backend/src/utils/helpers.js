const mongoose = require('mongoose');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data, status = 200, extra = {}) => res.status(status).json({ success: true, data, ...extra });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v) && mongoose.isValidObjectId(v);

function requireObjectId(v, label = 'id') {
  if (!isObjectId(String(v || ''))) throw new ApiError(400, `Invalid ${label}`);
  return String(v);
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Accepts an array or a comma/newline separated string; returns trimmed, non-empty strings. */
function toStringArray(v, max = 100) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : [];
  return arr.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, max);
}

const cleanStr = (v, max = 500) => (v == null ? '' : String(v).trim().slice(0, max));

const ownerFilter = (req) => (req.user.role === 'admin' ? {} : { createdBy: req.user.id });

function parsePaging(query, defLimit = 50) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Audit logging must never break the request it describes. */
async function audit(req, action, { candidate, job, metadata } = {}) {
  try {
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({ user: req.user && req.user.id, action, candidate, job, metadata });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { ApiError, asyncHandler, ok, isObjectId, requireObjectId, escapeRegex, toStringArray, cleanStr, ownerFilter, parsePaging, audit };
