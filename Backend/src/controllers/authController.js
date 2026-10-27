const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { ApiError, asyncHandler, ok, cleanStr, audit } = require('../utils/helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // equalises timing for unknown emails

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });

exports.register = asyncHandler(async (req, res) => {
  const name = cleanStr(req.body.name, 100);
  const email = cleanStr(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name) throw new ApiError(400, 'Name is required');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'A valid email is required');
  if (password.length < 8 || password.length > 128) throw new ApiError(400, 'Password must be 8-128 characters');
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');

  // Role is never taken from the request: admins are created out-of-band.
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'recruiter' });
  req.user = { id: String(user._id) };
  await audit(req, 'USER_REGISTERED');
  ok(res, { token: signToken(user), user: publicUser(user) }, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const email = cleanStr(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = email ? await User.findOne({ email }).select('+passwordHash') : null;
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw new ApiError(401, 'Invalid email or password');
  req.user = { id: String(user._id) };
  await audit(req, 'LOGIN');
  ok(res, { token: signToken(user), user: publicUser(user) });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(401, 'Invalid or expired token');
  ok(res, { user: publicUser(user) });
});
