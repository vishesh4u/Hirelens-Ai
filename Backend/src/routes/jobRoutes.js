const router = require('express').Router();
const c = require('../controllers/jobController');

router.route('/').get(c.list).post(c.create);
router.route('/:id').get(c.get).put(c.update).delete(c.remove);
router.post('/:id/analyze', c.analyze);
router.get('/:id/ranking', c.ranking);
router.post('/:id/ranking/simulate', c.simulate);
module.exports = router;
