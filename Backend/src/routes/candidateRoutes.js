const router = require('express').Router();
const multer = require('multer');
const c = require('../controllers/candidateController');
const { MAX_BYTES } = require('../services/resumeParser');

// Memory storage: the file is parsed and discarded; only extracted text + metadata are saved.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 12 } });

router.route('/').get(c.list).post(c.create);
router.post('/compare', c.compare); // before "/:id"
router.post('/upload', upload.single('resume'), c.upload);
router.route('/:id').get(c.get).put(c.update).delete(c.remove);
module.exports = router;
