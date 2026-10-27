const router = require('express').Router();
router.get('/:candidateId', require('../controllers/reportController').candidateReport);
module.exports = router;
