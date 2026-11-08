'use strict';
// Area router mounted at /api/admin/teaching (see routes/admin.js). Every route MUST use
// requireCapability(...) from ../policy. Business rules live in services, not here.
// Write commands return the fresh read model so the screen never shows stale data.
const router = require('express').Router();
const { requireCapability: cap, can } = require('../policy');
const { handle, id } = require('../validate');
const teaching = require('../teaching-service');
const cohorts = require('../cohort-service');
const projects = require('../teaching-projects');

const cohortView = (req, cohortId) => cohorts.cohortDetail(cohortId, req.user);
const canEditProjects = req => can(req.roles, 'projects.edit');
const projectView = (req, projectId) => projects.adminDetail(projectId, canEditProjects(req));
const directoryView = req => projects.adminList(canEditProjects(req));

// ---------- Cohorts & class schedule ----------
router.get('/cohort-options', cap('cohorts.read'), handle(() => teaching.cohortOptions()));
router.post('/cohorts', cap('cohorts.edit'), handle(req => teaching.createCohort(req.user, req.body), 201));
router.patch('/cohorts/:id', cap('cohorts.edit'), handle(req => cohortView(req, teaching.updateCohort(req.user, req.params.id, req.body).id)));
router.post('/cohorts/:id/status', cap('cohorts.edit'), handle(req => cohortView(req, teaching.setCohortStatus(req.user, req.params.id, req.body).id)));
router.post('/cohorts/:id/sessions', cap('cohorts.edit'), handle(req => { teaching.addSession(req.user, req.params.id, req.body); return cohortView(req, req.params.id); }, 201));
router.patch('/cohorts/:id/sessions/:sessionId', cap('cohorts.edit'), handle(req => { teaching.updateSession(req.user, req.params.id, req.params.sessionId, req.body); return cohortView(req, req.params.id); }));
// Read-only mentor weekly availability (mentor panel area owns the data) for scheduling classes.
router.get('/mentors/:mentorId/availability', cap('cohorts.read'), handle(req => require('../mentor-panel-service').readAvailability(id(req.params.mentorId, 'mentor ID'))));
router.post('/cohorts/:id/sessions/:sessionId/cancel', cap('cohorts.edit'), handle(req => { teaching.cancelSession(req.user, req.params.id, req.params.sessionId, req.body); return cohortView(req, req.params.id); }));

// ---------- Research projects ----------
router.get('/projects', cap('projects.read'), handle(req => directoryView(req)));
router.post('/projects', cap('projects.edit'), handle(req => projects.createProject(req.user, req.body), 201));
router.get('/projects/:id', cap('projects.read'), handle(req => projectView(req, req.params.id)));
router.patch('/projects/:id', cap('projects.edit'), handle(req => projectView(req, projects.updateProject(req.user, req.params.id, req.body).id)));
router.post('/projects/:id/milestones', cap('projects.edit'), handle(req => projectView(req, projects.addMilestone(req.user, req.params.id, req.body).id), 201));
router.patch('/projects/:id/milestones/:milestoneId', cap('projects.edit'), handle(req => projectView(req, projects.updateMilestone(req.user, req.params.id, req.params.milestoneId, req.body).id)));
router.post('/projects/:id/milestones/:milestoneId/move', cap('projects.edit'), handle(req => projectView(req, projects.moveMilestone(req.user, req.params.id, req.params.milestoneId, req.body).id)));
router.post('/projects/:id/milestones/:milestoneId/remove', cap('projects.edit'), handle(req => projectView(req, projects.removeMilestone(req.user, req.params.id, req.params.milestoneId, req.body).id)));
router.post('/projects/:id/applications/:appId/review', cap('projects.edit'), handle(req => {
  projects.reviewApplication(req.user, req.params.id, req.params.appId, req.body, { supervisorOnly: false });
  return projectView(req, req.params.id);
}));

// Projects page text and research tracks (shown on the public directory).
router.patch('/project-directory', cap('projects.edit'), handle(req => { projects.updateCopy(req.user, req.body); return directoryView(req); }));
router.post('/project-tracks', cap('projects.edit'), handle(req => { projects.createTrack(req.user, req.body); return directoryView(req); }, 201));
router.patch('/project-tracks/:id', cap('projects.edit'), handle(req => { projects.updateTrack(req.user, req.params.id, req.body); return directoryView(req); }));
router.post('/project-tracks/:id/move', cap('projects.edit'), handle(req => { projects.moveTrack(req.user, req.params.id, req.body); return directoryView(req); }));
router.post('/project-tracks/:id/remove', cap('projects.edit'), handle(req => { projects.removeTrack(req.user, req.params.id, req.body); return directoryView(req); }));

module.exports = router;
