const { db } = require('../db');

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function input(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) fail('Provide an object containing only the supported fields.');
  return body;
}
function text(value, name, min = 0, max = 2000) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
function integer(value, name, min = 0) { if (!Number.isSafeInteger(value) || value < min) fail(`Invalid ${name}.`); return value; }
function id(value) { if (!/^[1-9]\d*$/.test(String(value))) fail('Invalid ID.'); return integer(Number(value), 'ID', 1); }
function audit(actor, action, target) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actor, action, String(target), '{"module":"profiles","payload_logged":false}', new Date().toISOString());
}
function planText(value) {
  if (!value) return '';
  try { const parsed = JSON.parse(value); return typeof parsed === 'string' ? parsed : typeof parsed.text === 'string' ? parsed.text : typeof parsed.goal === 'string' ? parsed.goal : ''; }
  catch { return value; }
}
function profile(userId) {
  const user = db.prepare(`SELECT u.full_name, u.email, u.email_verified, COALESCE(s.phone, l.phone, '') AS phone,
    COALESCE(s.language,'en') AS language, COALESCE(s.timezone,'Asia/Dhaka') AS timezone,
    COALESCE(s.revision,0) AS version, COALESCE(l.goals,'') AS goals, COALESCE(l.interests,'') AS interests,
    l.study_plan FROM users u LEFT JOIN account_settings s ON s.user_id=u.id LEFT JOIN learner_profiles l ON l.user_id=u.id WHERE u.id=?`).get(userId);
  if (!user) fail('Account not found.', 404);
  return { ...user, email_verified: !!user.email_verified, study_plan: planText(user.study_plan) };
}
function saveProfile(userId, body) {
  input(body, ['full_name', 'phone', 'language', 'timezone', 'goals', 'interests', 'study_plan', 'version']);
  const name = text(body.full_name, 'Name', 2, 120), phone = text(body.phone, 'Phone', 0, 40);
  const goals = text(body.goals, 'Goals'), interests = text(body.interests, 'Interests', 0, 500), studyPlan = text(body.study_plan, 'Study plan');
  const language = text(body.language, 'Language', 2, 2), timezone = text(body.timezone, 'Timezone', 1, 100), version = integer(body.version, 'profile version');
  if (!['en', 'bn'].includes(language)) fail('Unsupported language.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { fail('Use a valid IANA timezone.'); }
  return db.transaction(() => {
    if (profile(userId).version !== version) fail('Your profile changed in another tab. Reload before saving.', 409);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET full_name=? WHERE id=?').run(name, userId);
    db.prepare(`INSERT INTO account_settings(user_id,phone,language,timezone,revision,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,language=excluded.language,timezone=excluded.timezone,revision=excluded.revision,updated_at=excluded.updated_at`).run(userId, phone || null, language, timezone, version + 1, now);
    db.prepare(`INSERT INTO learner_profiles(user_id,phone,goals,interests,study_plan,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,goals=excluded.goals,interests=excluded.interests,study_plan=excluded.study_plan,updated_at=excluded.updated_at`).run(userId, phone || null, goals, interests, JSON.stringify(studyPlan), now);
    audit(userId, 'profile_saved', userId);
    return profile(userId);
  })();
}

const applicationFields = ['public_name', 'bio', 'expertise', 'experience', 'availability', 'language', 'public_consent', 'version'];
function latest(userId) { return db.prepare('SELECT * FROM mentor_applications WHERE user_id=? ORDER BY revision DESC LIMIT 1').get(userId) || null; }
function approvedProfile(userId) {
  return db.prepare(`SELECT public_name,bio,expertise,status,public_visible,approved_revision_id,revision FROM mentor_profiles WHERE user_id=? AND status IN ('approved','suspended')`).get(userId) || null;
}
function ownApplication(userId) {
  const history = db.prepare(`SELECT id,application_id,decision,reason,created_at FROM mentor_decisions WHERE user_id=? ORDER BY id DESC`).all(userId);
  return { application: latest(userId), approved_profile: approvedProfile(userId), history };
}
function saveApplication(userId, body) {
  input(body, applicationFields);
  const values = [text(body.public_name, 'Public name', 0, 120), text(body.bio, 'Biography', 0, 3000),
    text(body.expertise, 'Expertise', 0, 500), text(body.experience, 'Experience', 0, 3000),
    text(body.availability, 'Availability', 0, 500), text(body.language, 'Language', 2, 4)];
  if (!['en','bn','both'].includes(body.language) || typeof body.public_consent !== 'boolean') fail('Choose a supported language and an explicit public-profile preference.');
  const version = integer(body.version, 'application version');
  return db.transaction(() => {
    const row = latest(userId), now = new Date().toISOString();
    const epoch = db.prepare('SELECT consent_epoch FROM mentor_profiles WHERE user_id=?').get(userId)?.consent_epoch ?? 0;
    if ((row?.version ?? 0) !== version) fail('This application changed. Reload before saving.', 409);
    if (row?.state === 'pending') fail('Submitted applications are locked. Withdraw it before editing.', 409);
    if (row?.state === 'draft') {
      db.prepare(`UPDATE mentor_applications SET public_name=?,bio=?,expertise=?,experience=?,availability=?,language=?,public_consent=?,consent_epoch=?,state='draft',version=version+1,updated_at=? WHERE id=?`).run(...values, Number(body.public_consent), epoch, now, row.id);
    } else {
      db.prepare(`INSERT INTO mentor_applications(user_id,revision,version,public_name,bio,expertise,experience,availability,language,public_consent,consent_epoch,state,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`).run(userId, (row?.revision ?? 0) + 1, (row?.version ?? 0) + 1, ...values, Number(body.public_consent), epoch, now, now);
    }
    audit(userId, 'mentor_draft_saved', latest(userId).id);
    return ownApplication(userId);
  })();
}
function transitionOwn(userId, action, body) {
  input(body, ['version']); const version = integer(body.version, 'application version', 1);
  return db.transaction(() => {
    const row = latest(userId);
    if (!row) fail('Application not found.', 404);
    if (row.version !== version) fail('This application changed. Reload before continuing.', 409);
    if (action === 'submit' && row.state !== 'draft') fail('Save a new draft before submitting.', 409);
    if (action === 'withdraw' && row.state !== 'pending') fail('Only a pending application can be withdrawn.', 409);
    if (action === 'submit') {
      text(row.public_name, 'Public name', 2, 120); text(row.bio, 'Biography', 20, 3000);
      text(row.expertise, 'Expertise', 3, 500); text(row.experience, 'Experience', 20, 3000); text(row.availability, 'Availability', 3, 500);
    }
    const now = new Date().toISOString(), state = action === 'submit' ? 'pending' : 'withdrawn';
    db.prepare('UPDATE mentor_applications SET state=?,version=version+1,submitted_at=CASE WHEN ? = \'pending\' THEN ? ELSE submitted_at END,updated_at=? WHERE id=?').run(state, state, now, now, row.id);
    audit(userId, `mentor_${action}`, row.id);
    return ownApplication(userId);
  })();
}

function queue(search = '') {
  if (typeof search !== 'string' || search.length > 120) fail('Search must contain at most 120 characters.');
  const rows = db.prepare(`SELECT u.id,u.full_name,u.email,u.status AS account_status,
    m.status AS mentor_status, COALESCE(m.public_visible,0) AS public_visible, COALESCE(m.revision,0) AS profile_version,
    a.id AS application_id,a.state AS application_state,a.revision,a.version,a.updated_at,a.expertise
    FROM users u LEFT JOIN mentor_profiles m ON m.user_id=u.id
    LEFT JOIN mentor_applications a ON a.id=(SELECT id FROM mentor_applications WHERE user_id=u.id AND submitted_at IS NOT NULL ORDER BY revision DESC LIMIT 1)
    WHERE (m.status IN ('approved','suspended') OR a.id IS NOT NULL) AND (u.full_name LIKE ? OR u.email LIKE ?)
    ORDER BY CASE WHEN a.state='pending' THEN 0 ELSE 1 END,a.updated_at DESC,u.id LIMIT 100`).all(`%${search}%`, `%${search}%`);
  return { mentors: rows, pending_count: db.prepare("SELECT COUNT(*) AS count FROM mentor_applications WHERE state='pending'").get().count, limit: 100 };
}
function reviewDetail(userId) {
  const user = db.prepare('SELECT id,full_name,email,status AS account_status FROM users WHERE id=?').get(userId);
  const application = db.prepare('SELECT * FROM mentor_applications WHERE user_id=? AND submitted_at IS NOT NULL ORDER BY revision DESC LIMIT 1').get(userId) || null;
  if (!user || (!application && !approvedProfile(userId))) fail('Submitted mentor record not found.', 404);
  return { user, application, approved_profile: approvedProfile(userId), history: db.prepare(`SELECT d.id,d.application_id,d.decision,d.reason,d.verification_note,d.grant_access,d.publish,d.created_at,u.full_name AS reviewer_name
    FROM mentor_decisions d JOIN users u ON u.id=d.reviewer_id WHERE d.user_id=? ORDER BY d.id DESC`).all(userId) };
}
function decide(reviewerId, roles, userId, body) {
  input(body, ['application_id','version','decision','reason','verification_note','grant_access','publish']);
  const applicationId = id(body.application_id), version = integer(body.version, 'application version', 1);
  const reason = text(body.reason, 'Decision reason', 10, 1500);
  if (!['approved','changes_requested','rejected'].includes(body.decision)) fail('Unsupported decision.');
  if (typeof body.grant_access !== 'boolean' || typeof body.publish !== 'boolean') fail('Choose explicit access and publication decisions.');
  const verification = text(body.verification_note, 'Private verification note', body.decision === 'approved' ? 15 : 0, 2000);
  if (body.decision !== 'approved' && (body.grant_access || body.publish)) fail('Only approval can grant access or publish.');
  if (body.grant_access && !roles.some(role => ['admin','owner'].includes(role))) fail('Only an administrator or owner can grant mentor access.', 403);
  if (reviewerId === userId) fail('You cannot review your own application.', 403);
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM mentor_applications WHERE id=? AND user_id=?").get(applicationId, userId);
    if (!row) fail('Application not found.', 404);
    if (row.state !== 'pending' || row.version !== version) fail('This submitted revision changed or was already reviewed. Reload before deciding.', 409);
    if (db.prepare('SELECT status FROM users WHERE id=?').get(userId)?.status !== 'active') fail('This account is not active.', 409);
    const epoch = db.prepare('SELECT consent_epoch FROM mentor_profiles WHERE user_id=?').get(userId)?.consent_epoch ?? 0;
    if (body.publish && (!row.public_consent || row.consent_epoch !== epoch)) fail('Public consent is missing or was withdrawn. A newly consented revision is required.', 409);
    const now = new Date().toISOString();
    db.prepare('UPDATE mentor_applications SET state=?,version=version+1,updated_at=? WHERE id=?').run(body.decision, now, row.id);
    if (body.decision === 'approved') {
      const alreadyApproved = approvedProfile(userId)?.status === 'approved';
      db.prepare(`INSERT INTO mentor_profiles(user_id,public_name,bio,expertise,status,public_visible,approved_revision_id,updated_at)
        VALUES (?,?,?,?,'approved',?,?,?) ON CONFLICT(user_id) DO UPDATE SET public_name=excluded.public_name,bio=excluded.bio,expertise=excluded.expertise,
        status='approved',public_visible=excluded.public_visible,approved_revision_id=excluded.approved_revision_id,revision=mentor_profiles.revision+1,updated_at=excluded.updated_at`)
        .run(userId, row.public_name, row.bio, row.expertise, Number(body.publish), row.id, now);
      // Copy approval and access are separate. Preserve active grants but never
      // revive legacy/suspended grants without an explicit new access decision.
      if (!alreadyApproved) db.prepare("DELETE FROM role_grants WHERE user_id=? AND role IN ('mentor','supervisor')").run(userId);
      if (body.grant_access) db.prepare(`INSERT INTO role_grants(user_id,role,scope,granted_by,created_at)
        SELECT ?,'mentor','global',?,? WHERE NOT EXISTS (SELECT 1 FROM role_grants WHERE user_id=? AND role='mentor'
        AND scope='global' AND (expiry IS NULL OR julianday(expiry)>julianday('now')))`)
        .run(userId, reviewerId, now, userId);
    }
    db.prepare(`INSERT INTO mentor_decisions(application_id,user_id,reviewer_id,decision,reason,verification_note,grant_access,publish,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(row.id, userId, reviewerId, body.decision, reason, verification, Number(body.grant_access), Number(body.publish), now);
    audit(reviewerId, `mentor_decision_${body.decision}`, row.id);
    db.prepare("INSERT INTO notifications(user_id,channel,template,deep_link,created_at) VALUES (?,'in_app',?,'/account/mentor-application',?)").run(userId, `Mentor application ${body.decision.replaceAll('_',' ')}. Open your application for feedback.`, now);
    return reviewDetail(userId);
  })();
}
function moderate(reviewerId, userId, body) {
  input(body, ['version','action','reason']); const version = integer(body.version, 'profile version', 1);
  const reason = text(body.reason, 'Reason', 10, 1500);
  if (!['suspend','hide'].includes(body.action)) fail('Unsupported moderation action.');
  if (reviewerId === userId) fail('You cannot moderate your own mentor privileges.', 403);
  return db.transaction(() => {
    const row = approvedProfile(userId);
    if (!row) fail('Approved profile not found.', 404);
    if (row.revision !== version || row.status !== 'approved') fail('This profile changed or is not active. Reload before continuing.', 409);
    db.prepare(`UPDATE mentor_profiles SET public_visible=0,status=?,revision=revision+1,updated_at=? WHERE user_id=?`).run(body.action === 'suspend' ? 'suspended' : row.status, new Date().toISOString(), userId);
    if (body.action === 'suspend') db.prepare("DELETE FROM role_grants WHERE user_id=? AND role IN ('mentor','supervisor')").run(userId);
    db.prepare('INSERT INTO mentor_decisions(user_id,reviewer_id,decision,reason,created_at) VALUES (?,?,?,?,?)').run(userId, reviewerId, body.action === 'suspend' ? 'suspended' : 'hidden', reason, new Date().toISOString());
    audit(reviewerId, `mentor_${body.action}`, userId);
    return reviewDetail(userId);
  })();
}

function hideOwn(userId, body) {
  input(body, ['version']); const version = integer(body.version, 'profile version', 1);
  return db.transaction(() => {
    const row = approvedProfile(userId);
    if (!row || row.revision !== version) fail('The public profile changed. Reload before continuing.', 409);
    db.prepare('UPDATE mentor_profiles SET public_visible=0,consent_epoch=consent_epoch+1,revision=revision+1,updated_at=? WHERE user_id=?').run(new Date().toISOString(), userId);
    audit(userId, 'mentor_public_consent_withdrawn', userId);
    return ownApplication(userId);
  })();
}

module.exports = { input, text, integer, id, profile, saveProfile, ownApplication, saveApplication, transitionOwn, queue, reviewDetail, decide, moderate, hideOwn };
