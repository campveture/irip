// Public planning proposals, not live calendar events or approved teaching promises.
const DAY = 86400000;
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

function weekendPlan(cohort, program) {
  const start = dateOnly(cohort.start_date);
  const end = dateOnly(cohort.end_date);
  const valid = start !== null && end !== null && end >= start && end - start <= DAY * 730;
  const contactMinutes = Number.isSafeInteger(program.contact_hours) && program.contact_hours >= 0 ? program.contact_hours * 60 : null;
  let remaining = contactMinutes;
  const sessions = [];
  if (valid && remaining !== null) {
    for (let day = start; day <= end && remaining > 0; day += DAY) {
      const weekday = new Date(day).getUTCDay();
      if (weekday !== 5 && weekday !== 6) continue;
      const minutes = Math.min(120, remaining);
      const endMinutes = 20 * 60 + 30 + minutes;
      sessions.push({ date: new Date(day).toISOString().slice(0, 10), start_time: '20:30',
        end_time: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
        duration_minutes: minutes });
      remaining -= minutes;
    }
  }
  return {
    status: 'proposed', timezone: 'Asia/Dhaka', weekend_days: ['Friday', 'Saturday'],
    start_time: '20:30', session_minutes: 120,
    duration_weeks: valid ? Math.ceil(((end - start) / DAY + 1) / 7) : null,
    contact_minutes: contactMinutes, scheduled_minutes: contactMinutes === null ? null : contactMinutes - remaining,
    unplaced_minutes: remaining, independent_hours_week: program.independent_hours_week || null,
    assignment_day: 'Thursday', assignment_time: '23:59', sessions,
  };
}

const syllabi = {
  'research-literacy': {
    weeks: 'Weeks 1–2', contact_hours: 8,
    outcomes: ['Turn a broad interest into a specific, answerable research question.', 'Distinguish a research claim from an opinion and identify appropriate evidence.', 'Recognise consent, privacy, plagiarism and authorship risks before starting a project.'],
    topics: [
      { title: 'Research foundations', items: ['Research purposes, questions, evidence and uncertainty.', 'Basic, applied, exploratory and explanatory research.', 'From a real-world problem to a bounded topic.'] },
      { title: 'Questions and research ethics', items: ['Population, context, concepts and scope of a question.', 'Feasibility, access to sources and realistic project limits.', 'Consent, confidentiality, citation, responsible AI use and honest reporting.'] },
    ],
    practice: ['Compare a weak question with a focused, researchable version.', 'Critique an evidence claim and explain what it does not establish.', 'Identify ethics risks in a synthetic study scenario.'],
    deliverable: 'Research-question brief: context, question, rationale, scope and an initial ethics checklist.',
    criteria: ['Clarity and scope', 'Evidence-based rationale', 'Feasibility and ethical awareness'],
    preparation: ['Bring a topic you are curious about; no previous research project is assumed.', 'Read the introductory ethics and research-literacy notes when approved.'],
  },
  'search-strategy': {
    weeks: 'Weeks 3–4', contact_hours: 8,
    outcomes: ['Build and document a repeatable literature search.', 'Judge source credibility and distinguish peer review from a quality guarantee.', 'Organise references and use citations without copying source wording.'],
    topics: [
      { title: 'Finding relevant evidence', items: ['Keywords, synonyms, Boolean operators and search strings.', 'Database discovery, date/language limits and inclusion criteria.', 'Backward/forward citation searching and documenting search decisions.'] },
      { title: 'Managing sources', items: ['Credibility, retractions, predatory publishing signals and limitations.', 'Reference-library setup, metadata checks, tags and duplicate removal.', 'Citation styles, paraphrasing, quotation and annotated reading lists.'] },
    ],
    practice: ['Run two search strategies and compare the results.', 'Keep a reproducible search log and screen a small source set.', 'Create an annotated bibliography using a reference manager such as Zotero.'],
    deliverable: 'Search log and annotated reading list with search strings, screening reasons and checked references.',
    criteria: ['Search reproducibility', 'Relevance and source appraisal', 'Accurate references and original annotation'],
    preparation: ['Use your question brief to identify core concepts.', 'Have a browser and a reference manager available; paid databases are not assumed.'],
  },
  'critical-reading': {
    weeks: 'Weeks 5–6', contact_hours: 8,
    outcomes: ['Read a paper for its question, design, evidence and limitations.', 'Compare studies without treating all evidence as equally strong.', 'Build a defensible gap argument rather than claiming no research exists.'],
    topics: [
      { title: 'Reading critically', items: ['Paper structure: abstract, introduction, methods, results and discussion.', 'Sampling, measurement, confounding and threats to validity.', 'What a result supports, what it does not, and how uncertainty is reported.'] },
      { title: 'Synthesising and mapping gaps', items: ['Literature matrices: questions, methods, findings and limitations.', 'Comparing agreement, disagreement and differences in context.', 'Evidence gaps, scope boundaries and a justified next research step.'] },
    ],
    practice: ['Annotate a paper and separate findings from interpretation.', 'Compare contrasting studies using a common extraction template.', 'Draft and peer-critique a gap statement supported by citations.'],
    deliverable: 'Literature matrix and a short cited gap argument explaining the proposed contribution and its limits.',
    criteria: ['Accurate evidence extraction', 'Comparison and synthesis', 'Well-supported gap and limitations'],
    preparation: ['Bring the screened sources from your search log.', 'Review the question brief and keep a record of how it changes.'],
  },
  'research-design': {
    weeks: 'Weeks 7–12', contact_hours: 24,
    outcomes: ['Choose a design that fits the question rather than a preferred tool.', 'Describe sampling, measurement, data access and an appropriate analysis plan.', 'Produce and revise a feasible research protocol with transparent limitations.'],
    topics: [
      { title: 'Weeks 7–8 · Design and methods', items: ['Qualitative, quantitative and mixed-method approaches: uses and trade-offs.', 'Observational, experimental and case-study designs at an introductory level.', 'Operational definitions, sampling frames, recruitment and bias.'] },
      { title: 'Weeks 9–10 · Data and analysis planning', items: ['Questionnaire/interview-guide basics and piloting with synthetic examples.', 'Secondary-data access, permissions, data quality and secure handling.', 'Matching descriptive, inferential or thematic analysis to the question.'] },
      { title: 'Weeks 11–12 · Feasibility and final protocol', items: ['Timeline, resources, risks, ethics and practical scope.', 'Protocol structure: background, question, methods, analysis and limitations.', 'Explaining design decisions, receiving rubric feedback and revising the final package.'] },
    ],
    practice: ['Compare two designs for the same question and justify a choice.', 'Create a sampling/data-management plan and test an instrument on synthetic examples.', 'Present a draft protocol and document revisions against a feedback checklist.'],
    deliverable: 'Final protocol and feasibility package: background, literature rationale, methods, ethics, data/analysis plan, timeline and revision notes.',
    criteria: ['Question–method alignment', 'Feasible and ethical implementation', 'Transparent analysis and limitations', 'Response to feedback and academic integrity'],
    preparation: ['Bring the question brief, search log and literature matrix.', 'No recruitment or real personal-data collection should begin without separate ethics and privacy approval.'],
  },
  'descriptive-stats': {
    weeks: 'Weeks 1–3', contact_hours: 10,
    outcomes: ['Identify variable types and prepare a small reproducible dataset.', 'Choose appropriate summaries and charts for a research question.', 'Explain variation, missing data and outliers without hiding them.'],
    topics: [
      { title: 'Data foundations', items: ['Units of observation, variable types and data dictionaries.', 'Data-entry checks, missing values, outliers and transparent cleaning.', 'Reproducible analysis notes and safe use of synthetic/open data.'] },
      { title: 'Summarising evidence', items: ['Counts, proportions, means, medians and modes.', 'Range, variance, standard deviation and interquartile range.', 'Tables, distributions, appropriate charts and misleading graphics.'] },
    ],
    practice: ['Clean a synthetic dataset and keep a transformation log.', 'Compare robust and non-robust summaries when outliers are present.', 'Prepare a small descriptive-results table with a plain-language interpretation.'],
    deliverable: 'Reproducible descriptive-analysis notebook or spreadsheet, with a data dictionary, charts and interpretation.',
    criteria: ['Correct summaries', 'Transparent data handling', 'Clear visualisation and interpretation'],
    preparation: ['Basic arithmetic and access to a laptop/spreadsheet tool.', 'Software choice and installation guide remain to be confirmed.'],
  },
  'inferential-stats': {
    weeks: 'Weeks 4–6', contact_hours: 10,
    outcomes: ['Distinguish a sample estimate from a population claim.', 'Interpret confidence intervals, effect sizes and p-values cautiously.', 'Select an introductory analysis and explain assumptions and limitations.'],
    topics: [
      { title: 'Uncertainty and estimation', items: ['Populations, samples, sampling variation and standard errors.', 'Confidence intervals and the distinction between precision and bias.', 'Effect size, practical significance and uncertainty.'] },
      { title: 'Testing and reporting', items: ['Null/alternative hypotheses, errors and multiple-comparison cautions.', 'Introductory comparisons, association and regression concepts.', 'Assumption checks, correlation versus causation and responsible results reporting.'] },
    ],
    practice: ['Use a synthetic resampling example to explore sampling variation.', 'Compare a p-value-only conclusion with an interval/effect-size interpretation.', 'Write a short analysis report that states assumptions and avoids causal overclaiming.'],
    deliverable: 'Introductory inference report with justified analysis choices, uncertainty and explicit limitations.',
    criteria: ['Appropriate method and assumptions', 'Correct uncertainty interpretation', 'Reproducible and cautious reporting'],
    preparation: ['Complete the descriptive-statistics foundations first.', 'Use synthetic/open data; advanced mathematical statistics is outside this outline.'],
  },
};

function syllabusFor(slug) {
  const plan = Object.prototype.hasOwnProperty.call(syllabi, slug) ? syllabi[slug] : null;
  return plan ? { status: 'proposed', ...plan } : null;
}

module.exports = { weekendPlan, syllabusFor, dateOnly };
