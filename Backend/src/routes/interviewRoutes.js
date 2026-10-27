const router = require('express').Router();
router.post('/questions', require('../controllers/interviewController').questions);
module.exports = router;
