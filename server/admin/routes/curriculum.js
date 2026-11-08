'use strict';
// Area router mounted at /api/admin/curriculum (see routes/admin.js). Every route MUST use
// requireCapability(...) from ../policy. Business rules live in services, not here.
//
//   catalog.read     – read programs, courses and their history
//   catalog.publish  – create/edit programs, publish/unpublish programs and courses, restore program versions
//   curriculum.edit  – courses, modules, lessons and assignments (create/edit/reorder/delete, restore course versions)
const router = require('express').Router();
const { requireCapability: cap, can } = require('../policy');
const { handle } = require('../validate');
const service = require('../curriculum-service');

const actor = req => req.session.userId;
const perms = req => ({ publish: can(req.roles, 'catalog.publish'), edit_curriculum: can(req.roles, 'curriculum.edit') });

router.get('/programs', cap('catalog.read'), handle(() => service.listPrograms()));
router.post('/programs', cap('catalog.publish'), handle(req => service.createProgram(actor(req), req.body), 201));
router.get('/programs/:id', cap('catalog.read'), handle(req => service.getProgram(req.params.id, perms(req))));
router.patch('/programs/:id', cap('catalog.publish'), handle(req => service.updateProgram(actor(req), req.params.id, req.body, perms(req))));
router.post('/programs/:id/publish', cap('catalog.publish'), handle(req => service.setProgramStatus(actor(req), req.params.id, req.body, true, perms(req))));
router.post('/programs/:id/unpublish', cap('catalog.publish'), handle(req => service.setProgramStatus(actor(req), req.params.id, req.body, false, perms(req))));
router.post('/programs/:id/revisions/:revisionId/restore', cap('catalog.publish'), handle(req => service.restoreProgram(actor(req), req.params.id, req.params.revisionId, req.body, perms(req))));

router.post('/programs/:id/courses', cap('curriculum.edit'), handle(req => service.createCourse(actor(req), req.params.id, req.body, perms(req)), 201));
router.patch('/courses/:id', cap('curriculum.edit'), handle(req => service.updateCourse(actor(req), req.params.id, req.body, perms(req))));
router.post('/courses/:id/move', cap('curriculum.edit'), handle(req => service.moveCourse(actor(req), req.params.id, req.body, perms(req))));
router.post('/courses/:id/revisions/:revisionId/restore', cap('curriculum.edit'), handle(req => service.restoreCourse(actor(req), req.params.id, req.params.revisionId, req.body, perms(req))));
router.post('/courses/:id/publish', cap('catalog.publish'), handle(req => service.setCourseStatus(actor(req), req.params.id, req.body, true, perms(req))));
router.post('/courses/:id/unpublish', cap('catalog.publish'), handle(req => service.setCourseStatus(actor(req), req.params.id, req.body, false, perms(req))));
router.delete('/courses/:id', cap('curriculum.edit'), handle(req => service.deleteCourse(actor(req), req.params.id, perms(req))));

router.post('/courses/:id/modules', cap('curriculum.edit'), handle(req => service.createModule(actor(req), req.params.id, req.body, perms(req)), 201));
router.patch('/modules/:id', cap('curriculum.edit'), handle(req => service.updateModule(actor(req), req.params.id, req.body, perms(req))));
router.post('/modules/:id/move', cap('curriculum.edit'), handle(req => service.moveModule(actor(req), req.params.id, req.body, perms(req))));
router.delete('/modules/:id', cap('curriculum.edit'), handle(req => service.deleteModule(actor(req), req.params.id, perms(req))));

router.post('/modules/:id/lessons', cap('curriculum.edit'), handle(req => service.createLesson(actor(req), req.params.id, req.body, perms(req)), 201));
router.patch('/lessons/:id', cap('curriculum.edit'), handle(req => service.updateLesson(actor(req), req.params.id, req.body, perms(req))));
router.post('/lessons/:id/move', cap('curriculum.edit'), handle(req => service.moveLesson(actor(req), req.params.id, req.body, perms(req))));
router.post('/lessons/:id/publish', cap('curriculum.edit'), handle(req => service.setLessonStatus(actor(req), req.params.id, req.body, true, perms(req))));
router.post('/lessons/:id/unpublish', cap('curriculum.edit'), handle(req => service.setLessonStatus(actor(req), req.params.id, req.body, false, perms(req))));
router.delete('/lessons/:id', cap('curriculum.edit'), handle(req => service.deleteLesson(actor(req), req.params.id, perms(req))));

router.post('/modules/:id/assessments', cap('curriculum.edit'), handle(req => service.createAssessment(actor(req), req.params.id, req.body, perms(req)), 201));
router.patch('/assessments/:id', cap('curriculum.edit'), handle(req => service.updateAssessment(actor(req), req.params.id, req.body, perms(req))));
router.post('/assessments/:id/move', cap('curriculum.edit'), handle(req => service.moveAssessment(actor(req), req.params.id, req.body, perms(req))));
router.delete('/assessments/:id', cap('curriculum.edit'), handle(req => service.deleteAssessment(actor(req), req.params.id, perms(req))));

module.exports = router;
