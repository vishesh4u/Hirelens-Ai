const router = require('express').Router();
const c = require('../controllers/screeningController');
router.post('/', c.screen);
router.get('/', c.history);
module.exports = router;
