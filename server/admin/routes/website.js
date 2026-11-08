'use strict';
// Area router mounted at /api/admin/website (see routes/admin.js). Every route MUST use
// requireCapability(...) from ../policy. Business rules live in services, not here.
const router = require('express').Router();
const { requireCapability: cap } = require('../policy');
const { handle } = require('../validate');
const content = require('../content-service');

const actor = req => req.user.id;

router.get('/site', cap('content.edit'), handle(() => content.getDocument('site')));
router.patch('/site', cap('content.edit'), handle(req => content.saveDocument('site', null, req.body, actor(req))));
router.post('/site/restore', cap('content.edit'), handle(req => content.restoreRevision('site', null, req.body, actor(req))));

router.get('/home', cap('content.edit'), handle(() => content.getDocument('home')));
router.patch('/home', cap('content.edit'), handle(req => content.saveDocument('home', null, req.body, actor(req))));
router.post('/home/restore', cap('content.edit'), handle(req => content.restoreRevision('home', null, req.body, actor(req))));

router.get('/pages', cap('content.edit'), handle(() => content.listPages()));
router.get('/pages/:key', cap('content.edit'), handle(req => content.getDocument('page', req.params.key)));
router.patch('/pages/:key', cap('content.edit'), handle(req => content.saveDocument('page', req.params.key, req.body, actor(req))));
router.post('/pages/:key/publish', cap('content.edit'), handle(req => content.setPublished(req.params.key, req.body, actor(req), true)));
router.post('/pages/:key/unpublish', cap('content.edit'), handle(req => content.setPublished(req.params.key, req.body, actor(req), false)));
router.post('/pages/:key/restore', cap('content.edit'), handle(req => content.restoreRevision('page', req.params.key, req.body, actor(req))));

module.exports = router;
