const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function now() {
  return new Date().toISOString();
}

function initSchema() {
  const stmt = db.transaction(() => {
    // ---------- Identity ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'learner',
        status TEXT DEFAULT 'active',
        email_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        scope TEXT DEFAULT 'global',
        expiry TEXT,
        granted_by INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (granted_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS learner_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        phone TEXT,
        goals TEXT,
        study_plan TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS scholarship_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        profile_json TEXT NOT NULL,
        consent_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recorded_courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        topic TEXT NOT NULL,
        level TEXT NOT NULL,
        language TEXT NOT NULL,
        outcomes_json TEXT NOT NULL,
        lessons_json TEXT NOT NULL,
        artwork TEXT NOT NULL DEFAULT 'causal',
        state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft', 'demo_catalog')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS growth_workspaces (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        goal TEXT NOT NULL,
        language TEXT NOT NULL CHECK(language IN ('en', 'bn')),
        weekly_minutes INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS growth_steps (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        step_id TEXT NOT NULL,
        notes TEXT NOT NULL,
        self_completed INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(user_id, step_id)
      );
      CREATE TABLE IF NOT EXISTS growth_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('baseline', 'capstone', 'application')),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        contribution TEXT NOT NULL,
        limitations TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft', 'submitted', 'changes_requested', 'reviewed')),
        reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS growth_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artifact_id INTEGER NOT NULL REFERENCES growth_artifacts(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        rubric_json TEXT NOT NULL,
        feedback TEXT NOT NULL,
        decision TEXT NOT NULL CHECK(decision IN ('changes_requested', 'reviewed')),
        created_at TEXT NOT NULL,
        UNIQUE(artifact_id, revision)
      );
      CREATE TABLE IF NOT EXISTS growth_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        message TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested', 'closed', 'cancelled')),
        response TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS growth_alumni (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        alias TEXT NOT NULL,
        interest TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'approved')),
        consent_at TEXT NOT NULL,
        moderated_by INTEGER REFERENCES users(id),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scholarship_applications (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opportunity_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('saved', 'researching', 'preparing', 'submitted', 'decision_received', 'withdrawn')),
        personal_deadline TEXT,
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, opportunity_id)
      );

      CREATE TABLE IF NOT EXISTS mentor_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        expertise TEXT,
        rate INTEGER,
        status TEXT DEFAULT 'pending',
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS account_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        phone TEXT,
        language TEXT NOT NULL DEFAULT 'en',
        timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
        marketing_email_consent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);

    // ---------- Academic catalog ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        domain TEXT,
        level TEXT,
        fee INTEGER,
        currency TEXT DEFAULT 'BDT',
        capacity INTEGER DEFAULT 30,
        start_date TEXT,
        end_date TEXT,
        contact_hours INTEGER DEFAULT 48,
        independent_hours_week TEXT DEFAULT '6-8',
        status TEXT DEFAULT 'published',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        summary TEXT,
        status TEXT DEFAULT 'published',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        week INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        kind TEXT DEFAULT 'video',
        url TEXT,
        transcript TEXT,
        duration_min INTEGER,
        release_window TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS prerequisite_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_skill INTEGER REFERENCES skills(id) ON DELETE CASCADE,
        to_skill INTEGER REFERENCES skills(id) ON DELETE CASCADE,
        UNIQUE(from_skill, to_skill)
      );
    `);

    // ---------- Sales / enrollment ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        type TEXT DEFAULT 'one_time',
        price INTEGER NOT NULL,
        currency TEXT DEFAULT 'BDT',
        admission_mode TEXT DEFAULT 'direct',
        access_duration TEXT DEFAULT '12 weeks',
        status TEXT DEFAULT 'published',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cohorts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        capacity INTEGER DEFAULT 30,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        enrollment_deadline TEXT,
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS seat_holds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        state TEXT DEFAULT 'draft',
        evidence TEXT,
        outcome TEXT,
        outcome_reason TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS admission_offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        state TEXT DEFAULT 'issued',
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        order_item_id INTEGER,
        state TEXT DEFAULT 'pending',
        entitlement_source TEXT DEFAULT 'purchase',
        created_at TEXT NOT NULL,
        UNIQUE(user_id, cohort_id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total INTEGER NOT NULL,
        currency TEXT DEFAULT 'BDT',
        status TEXT DEFAULT 'draft',
        policy_snapshot TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        offer_id INTEGER NOT NULL REFERENCES offers(id),
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id),
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        provider TEXT DEFAULT 'manual',
        reference TEXT,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'BDT',
        state TEXT DEFAULT 'pending',
        settled_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        state TEXT DEFAULT 'requested',
        actor INTEGER,
        reason TEXT,
        settled_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (actor) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        due_date TEXT NOT NULL,
        amount INTEGER NOT NULL,
        state TEXT DEFAULT 'pending',
        paid_at TEXT
      );
    `);

    // ---------- Learning / evidence ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        kind TEXT DEFAULT 'assignment',
        due_date TEXT,
        max_attempts INTEGER DEFAULT 3,
        rubric_version TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
        state TEXT DEFAULT 'draft',
        attempt INTEGER DEFAULT 1,
        brief TEXT,
        rubric TEXT,
        submitted_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER,
        feedback TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        kind TEXT DEFAULT 'teaching',
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        timezone TEXT DEFAULT 'Asia/Dhaka',
        meeting_link TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        present INTEGER DEFAULT 0,
        source TEXT DEFAULT 'manual',
        created_at TEXT NOT NULL,
        UNIQUE(session_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS teaching_assignments (
        mentor_id INTEGER NOT NULL REFERENCES users(id),
        cohort_id INTEGER NOT NULL REFERENCES cohorts(id),
        PRIMARY KEY (mentor_id, cohort_id)
      );
    `);

    // ---------- Research / projects ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        summary TEXT,
        supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        capacity INTEGER DEFAULT 1,
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        proposal TEXT,
        state TEXT DEFAULT 'pending',
        reviewed_by INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (reviewed_by) REFERENCES users(id),
        UNIQUE(project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        due_date TEXT,
        gate TEXT DEFAULT 'open',
        created_at TEXT NOT NULL
      );
    `);

    // ---------- Support / CRM ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        source TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opportunities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
        stage TEXT DEFAULT 'new',
        owner INTEGER REFERENCES users(id),
        next_task TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (owner) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
        opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_no TEXT UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        category TEXT DEFAULT 'general',
        subject TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        state TEXT DEFAULT 'open',
        assignee INTEGER REFERENCES users(id),
        sla_due TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (assignee) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // ---------- Certificates ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
        token TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        rule_version TEXT DEFAULT '1.0',
        state TEXT DEFAULT 'issued',
        revoked_at TEXT,
        revoked_reason TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (revoked_at) REFERENCES users(id)
      );
    `);

    // ---------- Reliability / audit ----------
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        target TEXT,
        meta TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (actor_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        template TEXT NOT NULL,
        channel TEXT DEFAULT 'in_app',
        read_state INTEGER DEFAULT 0,
        deep_link TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL
      );
    `);
    // Additive migration: existing cohort records keep an unset deadline until approved.
    if (!db.prepare('PRAGMA table_info(cohorts)').all().some(column => column.name === 'enrollment_deadline')) {
      db.exec('ALTER TABLE cohorts ADD COLUMN enrollment_deadline TEXT');
    }
    require('./profiles/schema').initProfiles(db);
    // Additive rebrand migration: keep existing synthetic demo records usable after the rename.
    for (const table of ['users', 'persons', 'mentor_intake']) {
      if (db.prepare('PRAGMA table_info(' + table + ')').all().some(column => column.name === 'email')) {
        db.prepare("UPDATE " + table + " SET email = replace(email, '@unknown.academy', '@irip.ac') WHERE email LIKE '%@unknown.academy'").run();
      }
    }
    db.prepare("UPDATE settings SET value = 'IRIP' WHERE key = 'site_name' AND value = 'Unknown Academy'").run();
    db.prepare("UPDATE audit_events SET meta = '{\"redacted\":true}' WHERE action IN ('login', 'signup') AND meta LIKE '%password%'").run();
  });
  stmt();
}

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

function seed() {
  const insert = db.transaction(() => {
    const settings = db.prepare('INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES (?, ?, ?)');
    const ts = now();
    settings.run('site_name', 'IRIP', ts);
    settings.run('refund_policy', 'Refunds are processed per the published refund policy. Contact support.', ts);
    settings.run('currency', 'BDT', ts);
    settings.run('timezone', 'Asia/Dhaka', ts);

    const addUser = db.prepare(
      'INSERT OR IGNORE INTO users(email, password_hash, full_name, role, status, email_verified, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );
    const grant = db.prepare(
      'INSERT OR IGNORE INTO role_grants(user_id, role, scope, granted_by, created_at) VALUES (?, ?, ?, 1, ?)'
    );
    const upsertProfile = db.prepare(
      'INSERT OR REPLACE INTO learner_profiles(user_id, phone, goals, study_plan, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    const upsertMentor = db.prepare(
      'INSERT OR REPLACE INTO mentor_profiles(user_id, bio, expertise, rate, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const pw = hashPassword('demo1234');

    // Admin
    const admin = addUser.run('admin@irip.ac', pw, 'Demo Administrator', 'admin', 'active', ts);
    grant.run(1, 'admin', 'global', ts);

    // Finance
    const finance = addUser.run('finance@irip.ac', pw, 'Finance Officer', 'finance', 'active', ts);
    grant.run(2, 'finance', 'global', ts);

    // Academic ops
    const academic = addUser.run('academic@irip.ac', pw, 'Academic Operations', 'academic_ops', 'active', ts);
    grant.run(3, 'academic_ops', 'global', ts);

    // Support
    const support = addUser.run('support@irip.ac', pw, 'Support Lead', 'support', 'active', ts);
    grant.run(4, 'support', 'global', ts);

    // Mentor
    const mentor = addUser.run('mentor@irip.ac', pw, 'Dr. Ayesha Rahman', 'mentor', 'active', ts);
    grant.run(5, 'mentor', 'global', ts);
    grant.run(5, 'supervisor', 'global', ts);
    upsertMentor.run(5, 'Senior research methods instructor with 10+ years supervising undergraduate and postgraduate research.', 'Research methods, statistics, academic writing', 5000, 'approved', ts);
    db.prepare('UPDATE mentor_profiles SET public_name = ? WHERE user_id = ?').run('Dr. Ayesha Rahman', 5);

    // Learner
    const learner = addUser.run('learner@irip.ac', pw, 'Rakib Hasan', 'learner', 'active', ts);
    grant.run(6, 'learner', 'global', ts);
    upsertProfile.run(6, '+880 1700 000000', 'Complete the research bootcamp and publish a paper.', JSON.stringify({ goal: 'Research publication', plan: [] }), ts);

    // Second learner
    const learner2 = addUser.run('student2@irip.ac', pw, 'Nusrat Jahan', 'learner', 'active', ts);
    grant.run(7, 'learner', 'global', ts);
    upsertProfile.run(7, '+880 1800 000000', 'Build research competence for postgraduate study.', JSON.stringify({ goal: 'Postgraduate readiness', plan: [] }), ts);

    // ---------- Programs ----------
    const addProgram = db.prepare(
      'INSERT OR IGNORE INTO programs(slug, title, summary, domain, level, fee, currency, capacity, start_date, end_date, contact_hours, independent_hours_week, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addProgram.run(
      'research-bootcamp',
      'Research Methods Bootcamp (3 Months)',
      'A supervised three-month research bootcamp combining structured theory with practical research projects. Learners progress from research literacy to a final assessed project package.',
      'Research Methods',
      'Undergraduate / Postgraduate',
      25000,
      'BDT',
      30,
      '2026-11-02',
      '2027-01-24',
      48,
      '6-8 hours',
      'published',
      ts
    );
    addProgram.run(
      'statistics-for-research',
      'Statistics for Research',
      'Foundational statistics for researchers: descriptive statistics, inference, hypothesis testing, and reproducible analysis.',
      'Economics / Statistics',
      'Undergraduate',
      12000,
      'BDT',
      40,
      '2026-11-09',
      '2026-12-14',
      20,
      '4-5 hours',
      'published',
      ts
    );
    addProgram.run(
      'academic-writing',
      'Academic Writing & Publication',
      'Structured academic writing, methods/results drafting, citations, and journal-fit planning.',
      'Social Sciences',
      'Postgraduate',
      15000,
      'BDT',
      25,
      '2026-11-16',
      '2026-12-21',
      16,
      '3-4 hours',
      'published',
      ts
    );

    const pBootcamp = db.prepare("SELECT id FROM programs WHERE slug = 'research-bootcamp'").get().id;
    const pStats = db.prepare("SELECT id FROM programs WHERE slug = 'statistics-for-research'").get().id;
    const pWriting = db.prepare("SELECT id FROM programs WHERE slug = 'academic-writing'").get().id;

    // ---------- Courses ----------
    const addCourse = db.prepare(
      'INSERT OR IGNORE INTO courses(slug, program_id, title, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    addCourse.run('research-literacy', pBootcamp, 'Research Literacy & Question Framing', 'Research ethics, realistic outcomes, and framing a research question.', 'published', ts);
    addCourse.run('search-strategy', pBootcamp, 'Search Strategy & Reference Management', 'Credible sources, search logs, annotated reading lists.', 'published', ts);
    addCourse.run('critical-reading', pBootcamp, 'Critical Reading & Gap Mapping', 'Literature matrix and gap argument.', 'published', ts);
    addCourse.run('research-design', pBootcamp, 'Research Design & Method Selection', 'Proposal and feasibility/data plan.', 'published', ts);
    addCourse.run('descriptive-stats', pStats, 'Descriptive Statistics', 'Measures of central tendency, dispersion, and visualization.', 'published', ts);
    addCourse.run('inferential-stats', pStats, 'Inferential Statistics', 'Hypothesis testing, confidence intervals, p-values.', 'published', ts);

    const c1 = db.prepare("SELECT id FROM courses WHERE slug = 'research-literacy'").get().id;
    const c2 = db.prepare("SELECT id FROM courses WHERE slug = 'search-strategy'").get().id;
    const c3 = db.prepare("SELECT id FROM courses WHERE slug = 'critical-reading'").get().id;
    const c4 = db.prepare("SELECT id FROM courses WHERE slug = 'research-design'").get().id;
    const c5 = db.prepare("SELECT id FROM courses WHERE slug = 'descriptive-stats'").get().id;

    // ---------- Modules ----------
    const addModule = db.prepare(
      'INSERT OR IGNORE INTO modules(course_id, title, week, created_at) VALUES (?, ?, ?, ?)'
    );
    addModule.run(c1, 'Week 1: Research Literacy', 1, ts);
    addModule.run(c2, 'Week 2: Search Strategy', 2, ts);
    addModule.run(c3, 'Week 3: Critical Reading', 3, ts);
    addModule.run(c4, 'Week 4: Research Design', 4, ts);
    addModule.run(c5, 'Week 1: Descriptive Stats', 1, ts);

    const m1 = db.prepare("SELECT id FROM modules WHERE title = 'Week 1: Research Literacy'").get().id;
    const m2 = db.prepare("SELECT id FROM modules WHERE title = 'Week 2: Search Strategy'").get().id;
    const m3 = db.prepare("SELECT id FROM modules WHERE title = 'Week 3: Critical Reading'").get().id;
    const m4 = db.prepare("SELECT id FROM modules WHERE title = 'Week 4: Research Design'").get().id;
    const m5 = db.prepare("SELECT id FROM modules WHERE title = 'Week 1: Descriptive Stats'").get().id;

    // ---------- Lessons ----------
    const addLesson = db.prepare(
      'INSERT OR IGNORE INTO lessons(module_id, title, kind, url, transcript, duration_min, release_window, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addLesson.run(m1, 'What is Research?', 'video', null, 'Transcript: Defining research and its purpose.', 20, 'Week 1', ts);
    addLesson.run(m1, 'Ethics & Realistic Outcomes', 'reading', null, 'Reading: ethics, integrity, and setting realistic expectations.', 15, 'Week 1', ts);
    addLesson.run(m2, 'Finding Credible Sources', 'video', null, 'Transcript: search strategies and source evaluation.', 25, 'Week 2', ts);
    addLesson.run(m2, 'Reference Management Tools', 'reading', null, 'Reading: using Zotero/Mendeley.', 15, 'Week 2', ts);
    addLesson.run(m3, 'Building a Literature Matrix', 'video', null, 'Transcript: mapping gaps in existing research.', 30, 'Week 3', ts);
    addLesson.run(m4, 'Selecting Your Method', 'video', null, 'Transcript: matching method to research question.', 30, 'Week 4', ts);
    addLesson.run(m5, 'Measures of Central Tendency', 'video', null, 'Transcript: mean, median, mode.', 20, 'Week 1', ts);

    // ---------- Offers ----------
    const addOffer = db.prepare(
      'INSERT OR IGNORE INTO offers(program_id, type, price, currency, admission_mode, access_duration, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addOffer.run(pBootcamp, 'one_time', 25000, 'BDT', 'direct', '12 weeks', 'published', ts);
    addOffer.run(pStats, 'one_time', 12000, 'BDT', 'direct', '6 weeks', 'published', ts);
    addOffer.run(pWriting, 'one_time', 15000, 'BDT', 'direct', '6 weeks', 'published', ts);

    const oBootcamp = db.prepare("SELECT id FROM offers WHERE program_id = ? AND type = 'one_time'").get(pBootcamp).id;
    const oStats = db.prepare("SELECT id FROM offers WHERE program_id = ? AND type = 'one_time'").get(pStats).id;

    // ---------- Cohorts ----------
    const addCohort = db.prepare(
      'INSERT OR IGNORE INTO cohorts(program_id, name, capacity, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    addCohort.run(pBootcamp, 'Cohort November 2026', 30, '2026-11-02', '2027-01-24', 'open', ts);
    addCohort.run(pStats, 'Cohort November 2026', 40, '2026-11-09', '2026-12-14', 'open', ts);

    const cohortBootcamp = db.prepare("SELECT id FROM cohorts WHERE name = 'Cohort November 2026' AND program_id = ?").get(pBootcamp).id;
    const cohortStats = db.prepare("SELECT id FROM cohorts WHERE name = 'Cohort November 2026' AND program_id = ?").get(pStats).id;

    // ---------- Enrollments (seed learner into bootcamp) ----------
    const addEnrollment = db.prepare(
      'INSERT OR IGNORE INTO enrollments(user_id, cohort_id, order_item_id, state, entitlement_source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    addEnrollment.run(6, cohortBootcamp, null, 'active', 'purchase', ts);
    addEnrollment.run(7, cohortStats, null, 'active', 'purchase', ts);

    // ---------- Orders (paid) ----------
    const addOrder = db.prepare(
      'INSERT OR IGNORE INTO orders(order_no, user_id, total, currency, status, policy_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    addOrder.run('ORD-2026-0001', 6, 25000, 'BDT', 'paid', 'Refund policy v1.0; access duration 12 weeks.', ts);
    addOrder.run('ORD-2026-0002', 7, 12000, 'BDT', 'paid', 'Refund policy v1.0; access duration 6 weeks.', ts);

    const order1 = db.prepare("SELECT id FROM orders WHERE order_no = 'ORD-2026-0001'").get().id;
    const order2 = db.prepare("SELECT id FROM orders WHERE order_no = 'ORD-2026-0002'").get().id;

    const addOrderItem = db.prepare(
      'INSERT OR IGNORE INTO order_items(order_id, offer_id, cohort_id, name, price, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    addOrderItem.run(order1, oBootcamp, cohortBootcamp, 'Research Methods Bootcamp', 25000, ts);
    addOrderItem.run(order2, oStats, cohortStats, 'Statistics for Research', 12000, ts);

    const addPayment = db.prepare(
      'INSERT OR IGNORE INTO payment_attempts(order_id, provider, reference, amount, currency, state, settled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addPayment.run(order1, 'manual', 'REF-DEMO-001', 25000, 'BDT', 'succeeded', ts, ts);
    addPayment.run(order2, 'manual', 'REF-DEMO-002', 12000, 'BDT', 'succeeded', ts, ts);

    // Link enrollments to order items
    db.prepare("UPDATE enrollments SET order_item_id = (SELECT id FROM order_items WHERE order_id = ? AND cohort_id = enrollments.cohort_id) WHERE user_id = ? AND cohort_id = ?").run(order1, 6, cohortBootcamp);
    db.prepare("UPDATE enrollments SET order_item_id = (SELECT id FROM order_items WHERE order_id = ? AND cohort_id = enrollments.cohort_id) WHERE user_id = ? AND cohort_id = ?").run(order2, 7, cohortStats);

    // ---------- Assessments ----------
    const addAssessment = db.prepare(
      'INSERT OR IGNORE INTO assessments(module_id, title, kind, due_date, max_attempts, rubric_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    addAssessment.run(m1, 'Research Question Draft', 'assignment', due, 3, 'v1.0', ts);
    addAssessment.run(m2, 'Search Log & Reading List', 'assignment', due, 3, 'v1.0', ts);
    addAssessment.run(m3, 'Literature Matrix', 'assignment', due, 3, 'v1.0', ts);
    addAssessment.run(m4, 'Proposal & Feasibility Plan', 'assignment', due, 3, 'v1.0', ts);
    addAssessment.run(m5, 'Descriptive Stats Practice', 'assignment', due, 3, 'v1.0', ts);

    const a1 = db.prepare("SELECT id FROM assessments WHERE title = 'Research Question Draft'").get().id;
    const a5 = db.prepare("SELECT id FROM assessments WHERE title = 'Descriptive Stats Practice'").get().id;

    // ---------- Submissions ----------
    const addSubmission = db.prepare(
      'INSERT OR IGNORE INTO submissions(assessment_id, user_id, enrollment_id, state, attempt, brief, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addSubmission.run(a1, 6, db.prepare("SELECT id FROM enrollments WHERE user_id = 6 AND cohort_id = ?").get(cohortBootcamp).id, 'submitted', 1, 'My research question: ...', ts, ts);
    addSubmission.run(a5, 7, db.prepare("SELECT id FROM enrollments WHERE user_id = 7 AND cohort_id = ?").get(cohortStats).id, 'graded', 1, 'Completed practice set.', ts, ts);

    const s1 = db.prepare("SELECT id FROM submissions WHERE assessment_id = ? AND user_id = 6 ORDER BY id DESC LIMIT 1").get(a1).id;
    const s2 = db.prepare("SELECT id FROM submissions WHERE assessment_id = ? AND user_id = 7").get(a5).id;

    // ---------- Grades ----------
    const addGrade = db.prepare(
      'INSERT OR IGNORE INTO grades(submission_id, reviewer_id, score, feedback, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    addGrade.run(s2, 5, 85, 'Solid understanding of central tendency. Well done.', ts);

    // ---------- Announcements ----------
    const addAnnouncement = db.prepare(
      'INSERT OR IGNORE INTO announcements(cohort_id, title, body, published_at, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    addAnnouncement.run(cohortBootcamp, 'Welcome to Cohort November 2026', 'The proposed cohort window begins on 2 November 2026. The first demo teaching session is Friday 6 November at 8:30 PM Bangladesh time. Dates require approval.', ts, ts);
    addAnnouncement.run(cohortBootcamp, 'First Clinic Scheduled', 'The proposed first demo clinic is Saturday 7 November 2026, 8:30 PM Bangladesh time. This is not a live booking.', ts, ts);

    // ---------- Sessions ----------
    const addSession = db.prepare(
      'INSERT OR IGNORE INTO sessions(cohort_id, title, kind, starts_at, ends_at, timezone, meeting_link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const wk1 = new Date('2026-11-06T20:30:00+06:00').toISOString();
    addSession.run(cohortBootcamp, 'Teaching Session 1: Research Literacy', 'teaching', wk1, new Date(new Date(wk1).getTime() + 120 * 60000).toISOString(), 'Asia/Dhaka', null, ts);
    addSession.run(cohortBootcamp, 'Supervised Clinic 1', 'clinic', new Date('2026-11-07T20:30:00+06:00').toISOString(), new Date('2026-11-07T22:30:00+06:00').toISOString(), 'Asia/Dhaka', null, ts);

    // ---------- Projects ----------
    const addProject = db.prepare(
      'INSERT OR IGNORE INTO projects(title, summary, supervisor_id, capacity, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    addProject.run('Secondary Data Analysis in Public Health', 'Analyze open public health data using reproducible methods.', 5, 3, 'open', ts);

    const proj1 = db.prepare("SELECT id FROM projects WHERE title = 'Secondary Data Analysis in Public Health'").get().id;

    // ---------- CRM persons / opportunities ----------
    const addPerson = db.prepare(
      'INSERT OR IGNORE INTO persons(name, email, phone, source, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    addPerson.run('Prospective Learner', 'prospect@irip.ac', '+880 1900 000000', 'website', ts);
    addPerson.run('University Partner', 'partner@university.edu.bd', '+880 2 0000000', 'outreach', ts);

    const person1 = db.prepare("SELECT id FROM persons WHERE email = 'prospect@irip.ac'").get().id;
    const person2 = db.prepare("SELECT id FROM persons WHERE email = 'partner@university.edu.bd'").get().id;

    const addOpportunity = db.prepare(
      'INSERT OR IGNORE INTO opportunities(person_id, program_id, stage, owner, next_task, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    addOpportunity.run(person1, pBootcamp, 'qualified', 4, 'Send program brochure', ts);
    addOpportunity.run(person2, pWriting, 'consultation', 3, 'Schedule scope call', ts);

    // ---------- Tickets ----------
    const addTicket = db.prepare(
      'INSERT OR IGNORE INTO tickets(ticket_no, user_id, category, subject, priority, state, assignee, sla_due, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const sla = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    addTicket.run('TKT-2026-1001', 6, 'billing', 'Receipt for ord-2026-0001', 'normal', 'open', 4, sla, ts);
    addTicket.run('TKT-2026-1002', 7, 'academic', 'Extension request for assignment', 'normal', 'in_progress', 4, sla, ts);

    const t1 = db.prepare("SELECT id FROM tickets WHERE ticket_no = 'TKT-2026-1001'").get().id;
    const addTicketMessage = db.prepare(
      'INSERT OR IGNORE INTO ticket_messages(ticket_id, user_id, body, created_at) VALUES (?, ?, ?, ?)'
    );
    addTicketMessage.run(t1, 6, 'I have not received my payment receipt. Please resend.', ts);
    addTicketMessage.run(t1, 4, 'Thank you for contacting us. I have resent the receipt to your email.', ts);

    // ---------- Certificates ----------
    const addCertificate = db.prepare(
      'INSERT OR IGNORE INTO certificates(user_id, program_id, cohort_id, token, display_name, issue_date, rule_version, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addCertificate.run(7, pStats, cohortStats, 'CERT-DEMO-ABC123', 'Nusrat Jahan', ts, 'v1.0', 'issued', ts);
  });
  insert();
  console.log('Seed complete.');
}

module.exports = { db, initSchema, hashPassword, verifyPassword, now, seed };
