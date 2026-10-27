const router = require('express').Router();
const c = require('../controllers/analyticsController');
router.get('/analytics', c.analytics);
router.get('/audit-logs', c.auditLogs);
module.exports = router;
