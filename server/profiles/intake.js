// Public applications are not accounts. An unverified email must never be used
// to attach an application to an existing identity or grant capabilities.
const { db } = require('../db');
const { input, text, integer } = require('./service');
const fields = ['full_name','email','professional_title','qualification','experience_years','expertise','experience','profile_url','availability','language','motivation','consent','accuracy'];
const accepted = { accepted: true, message: 'Application received for review. If an open application already exists for this email, staff will review that application. No account was created and no email was sent.' };
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function validate(body) {
  input(body, fields);
  const data = {
    full_name: text(body.full_name, 'Full name', 2, 120),
    email: text(body.email, 'Email', 3, 254).toLowerCase(),
    professional_title: text(body.professional_title, 'Professional role', 2, 160),
    qualification: text(body.qualification, 'Qualifications', 10, 1000),
    experience_years: integer(body.experience_years, 'years of experience'),
    expertise: text(body.expertise, 'Expertise', 3, 500),
    experience: text(body.experience, 'Experience', 40, 3000),
    profile_url: text(body.profile_url, 'Profile link', 0, 500),
    availability: text(body.availability, 'Availability', 10, 500),
    language: text(body.language, 'Language', 2, 4),
    motivation: text(body.motivation, 'Mentoring approach', 40, 2000),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('Enter a valid email address.');
  if (data.experience_years > 60) fail('Years of experience must be between 0 and 60.');
  if (!['en','bn','both'].includes(data.language)) fail('Choose a supported teaching language.');
  if (data.profile_url) {
    try { const url = new URL(data.profile_url); if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error(); }
    catch { fail('Use an HTTPS professional-profile link without credentials, or leave it blank.'); }
  }
  if (body.consent !== true || body.accuracy !== true) fail('Confirm application review consent and the accuracy declaration.');
  return data;
}
function audit(actorId, action, id, now) {
  db.prepare('INSERT INTO audit_events(actor_id,action,target,meta,created_at) VALUES (?,?,?,?,?)')
    .run(actorId, action, `mentor_intake:${id}`, '{"payload_logged":false}', now);
}
function submit(body) {
  const data = validate(body);
  return db.transaction(() => {
    // Same acknowledgement for new/existing addresses; no email enumeration,
    // unauthenticated edits, status lookup, or duplicate application overwrite.
    if (db.prepare("SELECT id FROM mentor_intake WHERE email=? AND state IN ('pending','changes_requested','approved')").get(data.email)) return accepted;
    const now = new Date().toISOString();
    const row = db.prepare(`INSERT INTO mentor_intake(full_name,email,professional_title,qualification,experience_years,expertise,experience,profile_url,availability,language,motivation,consent_at,consent_version,created_at,updated_at)
      VALUES (@full_name,@email,@professional_title,@qualification,@experience_years,@expertise,@experience,@profile_url,@availability,@language,@motivation,@now,'mentor-intake-v1',@now,@now)`).run({ ...data, now });
    audit(null, 'mentor_intake_submitted', row.lastInsertRowid, now);
    return accepted;
  })();
}
function list(search = '') {
  search = text(search, 'Search', 0, 120);
  return {
    applications: db.prepare(`SELECT id,full_name,email,professional_title,expertise,state,version,created_at FROM mentor_intake
      WHERE full_name LIKE ? OR email LIKE ? ORDER BY CASE WHEN state IN ('pending','changes_requested') THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 100`).all(`%${search}%`, `%${search}%`),
    pending_count: db.prepare("SELECT COUNT(*) AS n FROM mentor_intake WHERE state IN ('pending','changes_requested')").get().n,
  };
}
function detail(id) {
  const application = db.prepare(`SELECT id,full_name,email,professional_title,qualification,experience_years,expertise,experience,profile_url,availability,language,motivation,state,version,consent_at,created_at FROM mentor_intake WHERE id=?`).get(id);
  if (!application) fail('Application not found.', 404);
  const history = db.prepare(`SELECT d.id,d.decision,d.reason,d.verification_note,d.created_at,u.full_name AS reviewer_name
    FROM mentor_intake_decisions d JOIN users u ON u.id=d.reviewer_id WHERE d.application_id=? ORDER BY d.id DESC`).all(id);
  return { application, history };
}
function decide(actor, id, body) {
  input(body, ['version','decision','reason','verification_note']);
  const version = integer(body.version, 'application version', 1);
  if (!['approved','changes_requested','rejected'].includes(body.decision)) fail('Choose a supported decision.');
  const reason = text(body.reason, 'Decision reason', 10, 1500);
  const note = text(body.verification_note, 'Verification note', body.decision === 'approved' ? 15 : 0, 2000);
  return db.transaction(() => {
    const { application } = detail(id);
    if (actor.email.toLowerCase() === application.email) fail('You cannot review an application using your own email.', 403);
    if (!['pending','changes_requested'].includes(application.state) || application.version !== version) fail('Application changed or was already decided. Reload before reviewing.', 409);
    const now = new Date().toISOString();
    db.prepare('UPDATE mentor_intake SET state=?,version=version+1,updated_at=? WHERE id=?').run(body.decision, now, id);
    db.prepare('INSERT INTO mentor_intake_decisions(application_id,reviewer_id,decision,reason,verification_note,created_at) VALUES (?,?,?,?,?,?)').run(id, actor.id, body.decision, reason, note, now);
    audit(actor.id, `mentor_intake_${body.decision}`, id, now);
    // Deliberately no users/role_grants/mentor_profiles writes. Approved intake
    // is only approved for verified onboarding, never public listing or access.
    return detail(id);
  })();
}
module.exports = { submit, list, detail, decide };
