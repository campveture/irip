const router = require('express').Router();
const { rateLimit } = require('../middleware/security');
const intake = require('./intake');
router.post('/', rateLimit({ limit: 15, windowMs: 15 * 60000 }), (req, res) => {
  try { res.status(202).json(intake.submit(req.body)); }
  catch (error) { res.status(error.status === 400 ? 400 : 500).json({ message: error.status === 400 ? error.message : 'Application could not be saved. Please retry.' }); }
});
module.exports = router;
