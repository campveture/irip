const router = require('express').Router();
const { requireAuth, requireRoles } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');
const service = require('./service');

// Explicit projections and own-session identity, never a body-supplied user ID.
router.use(requireAuth);
const commandLimit = rateLimit({ limit: 60 });
router.use((req, res, next) => ['GET','HEAD'].includes(req.method) ? next() : commandLimit(req, res, next));
const handle = fn => (req, res) => {
  try { res.json(fn(req)); }
  catch (error) { res.status([400,403,404,409].includes(error.status) ? error.status : 500).json({ error: error.status ? 'validation' : 'server', message: error.status ? error.message : 'The profile request could not be completed.' }); }
};
router.get('/profile', handle(req => ({ profile: service.profile(req.user.id) })));
router.patch('/profile', handle(req => ({ profile: service.saveProfile(req.user.id, req.body) })));
router.get('/mentor-application', handle(req => service.ownApplication(req.user.id)));
router.post('/mentor-profile/hide', handle(req => service.hideOwn(req.user.id, req.body)));
router.patch('/mentor-application', handle(req => service.saveApplication(req.user.id, req.body)));
router.post('/mentor-application/:action', handle(req => {
  if (!['submit','withdraw'].includes(req.params.action)) { const error = new Error('Action not found.'); error.status = 404; throw error; }
  return service.transitionOwn(req.user.id, req.params.action, req.body);
}));
router.use('/operations', requireRoles('academic_ops','admin','owner'));
router.get('/operations/mentor-intake', handle(req => require('./intake').list(req.query.search)));
router.get('/operations/mentor-intake/:id', handle(req => require('./intake').detail(service.id(req.params.id))));
router.post('/operations/mentor-intake/:id/decision', handle(req => require('./intake').decide(req.user, service.id(req.params.id), req.body)));
router.get('/operations/mentors', handle(req => service.queue(req.query.search)));
router.get('/operations/mentors/:id', handle(req => service.reviewDetail(service.id(req.params.id))));
router.post('/operations/mentors/:id/decision', handle(req => service.decide(req.user.id, req.roles, service.id(req.params.id), req.body)));
router.post('/operations/mentors/:id/moderation', handle(req => service.moderate(req.user.id, service.id(req.params.id), req.body)));
module.exports = router;
