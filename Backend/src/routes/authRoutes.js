const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/authController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many attempts. Please try again later.' }
});

router.post('/register', limiter, c.register);
router.post('/login', limiter, c.login);
router.get('/me', requireAuth, c.me);
module.exports = router;
