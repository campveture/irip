export type ValueStage = 'foundation' | 'pilot' | 'after-graduates';
export interface ValueProposal {
  id: string;
  title: string;
  status: 'proposal';
  stage: ValueStage;
  owner: string;
  problem: string;
  outcome: string;
  scope: readonly string[];
  launchGates: readonly string[];
  measures: readonly string[];
  boundary: string;
}

export const valueStages: readonly { id: ValueStage; title: string; description: string }[] = [
  { id: 'foundation', title: '1. Make learning worth paying for', description: 'Prioritise these before a paid launch. A useful learning experience matters more than another feature.' },
  { id: 'pilot', title: '2. Pilot credible next steps', description: 'Start small only when reviewers, partners and safeguarding are genuinely in place. No placement promise.' },
  { id: 'after-graduates', title: '3. Build a network from real graduates', description: 'An alumni network should grow from actual completions and opt-in participation, not a fabricated directory.' },
];

export const valueProposals: readonly ValueProposal[] = [
  {
    id: 'guided-pathways', title: 'A guided path, not a pile of videos', status: 'proposal', stage: 'foundation', owner: 'Academic lead',
    problem: 'A beginner may not know what to study next, which prerequisites matter, or when they are ready to apply a skill.',
    outcome: 'A student can choose a realistic goal, follow a manageable path, and demonstrate the intended skill.',
    scope: ['A short, low-stakes starting-point check and a learner-chosen goal.', 'A prerequisite-aware sequence with a realistic workload, examples and practice.', 'Equivalent before/after tasks assessed against a published rubric; no opaque ability score.'],
    launchGates: ['Approved learning outcomes and an expert-reviewed sample pathway.', 'A small learner pilot testing comprehension, workload and clarity.', 'Human review of assessment quality and an accessible way to challenge results.'],
    measures: ['Learners meeting the rubric / all learners who attempted the equivalent assessment; report missing follow-up separately.', 'Path completion / all enrolled learners, with dropouts and reasons visible—not just successful completers.'],
    boundary: 'No automatic claim of employability, scholarship eligibility or mastery from watch time.',
  },
  {
    id: 'practice-feedback', title: 'Practice, feedback and a chance to improve', status: 'proposal', stage: 'foundation', owner: 'Academic operations',
    problem: 'Watching an explanation does not tell a student whether their own work is correct or how to improve it.',
    outcome: 'A student produces work, understands specific weaknesses, and can revise it with accountable support.',
    scope: ['Topic-level practice tasks using safe, reusable datasets and worked examples.', 'Rubric-based human feedback, revision opportunities and moderated question clinics.', 'A clearly costed support tier: distinguish membership content from any separately approved human-review service.'],
    launchGates: ['Named, qualified reviewers with tested capacity and published support limits.', 'An approved feedback rubric, escalation process and feasible turnaround policy.', 'A costed pilot before any promise of unlimited reviews, office hours or one-to-one access.'],
    measures: ['Median and upper-range feedback turnaround, including overdue work.', 'Rubric improvement between initial and revised submissions, alongside the number who did not revise.'],
    boundary: 'No unlimited mentoring or included feedback entitlement is being offered by the BDT 2,000 proposal.',
  },
  {
    id: 'portfolio', title: 'A portfolio that shows what you can do', status: 'proposal', stage: 'foundation', owner: 'Academic lead and content operations',
    problem: 'A certificate alone may not help a reviewer understand the student’s contribution, reasoning or practical ability.',
    outcome: 'A student leaves with a defensible research or analysis artifact, not just a completion badge.',
    scope: ['An assessed capstone such as a research protocol, reproducible analysis, literature map or evidence brief.', 'A short explanation of the student’s contribution, methods, limitations and revisions.', 'Private-by-default work, with a separate, revocable choice to publish a redacted showcase.'],
    launchGates: ['Approved capstone rubrics, originality rules and reviewer capacity.', 'Clear learner IP ownership, attribution, data rights and publication consent.', 'A safe redaction and removal process; no confidential research data in public examples.'],
    measures: ['Assessed artifacts meeting the rubric / all capstones submitted.', 'Consented reviewer assessments of artifact quality; do not equate a portfolio with a job offer.'],
    boundary: 'No guaranteed publication, authorship credit, employer endorsement or job outcome.',
  },
  {
    id: 'access-affordability', title: 'Access that fits students’ actual circumstances', status: 'proposal', stage: 'foundation', owner: 'Product, accessibility and finance leads',
    problem: 'Price, language, disability, bandwidth and device limitations can prevent learning even when the course content is strong.',
    outcome: 'A student can understand the offer and use the learning material on a realistic budget and device.',
    scope: ['Bangla-friendly explanations where appropriate, corrected captions, searchable transcripts and low-bandwidth mobile testing.', 'A useful free sample and transparent content, support, access-duration and cancellation boundaries before any payment.', 'An affordability study and a separately approved need-based access pilot, if a budget exists.'],
    launchGates: ['Testing with target learners on lower-end phones and constrained connections.', 'Accessible content and interface review, plus rights approval for any downloads.', 'Explicit pricing, billing-period and financial approval before promising aid, discounts or recurring access.'],
    measures: ['Task completion and comprehension on target devices and assistive technologies.', 'Affordability and willingness-to-pay feedback with sample size; no claim that BDT 2,000 is already validated.'],
    boundary: 'No scholarship fund, fee waiver, offline-download right or subsidised place is currently promised.',
  },
  {
    id: 'internships-research', title: 'Verified internships and research-assistant pathways', status: 'proposal', stage: 'pilot', owner: 'Partnerships and learner-support leads',
    problem: 'Students may develop skills but lack trustworthy ways to gain supervised experience or understand real application requirements.',
    outcome: 'A student can inspect a genuine role, judge its terms and apply with informed expectations.',
    scope: ['Vetted internships, research-assistant roles and scoped project placements—not a generic job scrape.', 'Disclose paid/unpaid status, stipend or pay where applicable, workload, location, supervisor, eligibility and deadline.', 'Application preparation, a permission-based referral process and a route for reporting unsafe or misleading roles.'],
    launchGates: ['A verified host and written agreement with a real supervisor, scope and selection process.', 'Legal and safeguarding review, transparent compensation, no pay-to-access-role fees and a complaints process.', 'Explicit consent before sharing any CV or profile, plus expiry checks and limited pilot capacity.'],
    measures: ['Eligible applicants, interviews and offers reported separately, with dates and denominators.', 'Paid/unpaid breakdown, completed supervised experiences, learner feedback and complaint resolution.'],
    boundary: 'Placement, employment, pay and research authorship are never guaranteed. The existing demo board is not evidence of a live partner pipeline.',
  },
  {
    id: 'application-clinics', title: 'Career and postgraduate application clinics', status: 'proposal', stage: 'pilot', owner: 'Learner success and qualified reviewers',
    problem: 'Finding a scholarship or role is different from preparing a clear CV, research statement and well-supported application.',
    outcome: 'A student can present their own work clearly and understand what still needs checking before applying.',
    scope: ['Limited-scope CV, portfolio and research-statement review, plus interview or proposal-presentation practice.', 'Use the scholarship planner as a starting point, then check current provider-specific requirements manually.', 'Give feedback on the student’s own application; preserve academic integrity and personal agency.'],
    launchGates: ['Qualified reviewers, defined review limits, transparent capacity and approved service pricing or inclusion.', 'Privacy, retention and explicit consent rules for any application materials.', 'Current official-source checks and an escalation route for questions outside reviewer expertise.'],
    measures: ['Rubric-based improvement in application clarity and completeness.', 'Learner-reported usefulness; any later admissions outcomes must be voluntary, contextualised and not attributed solely to IRIP.'],
    boundary: 'No ghostwritten applications, fabricated achievements, visa advice, admission guarantee or scholarship guarantee.',
  },
  {
    id: 'alumni-network', title: 'An opt-in alumni and peer network', status: 'proposal', stage: 'after-graduates', owner: 'Community and safeguarding leads',
    problem: 'Learning can stop at course completion, and graduates may have no trusted place to exchange feedback or find collaborators.',
    outcome: 'Actual graduates can stay connected, learn from one another and choose whether to mentor or share opportunities.',
    scope: ['A moderated opt-in community for verified completers; a separate peer space for current learners.', 'Voluntary peer review, research reading groups and small alumni-to-learner mentoring pilots.', 'Member-controlled visibility and introductions; no public contact details or automatic employer sharing.'],
    launchGates: ['Actual qualifying graduates and a transparent definition of alumni eligibility.', 'Community rules, trained moderators, safe contact controls and reporting/blocking processes.', 'Separate consent for membership, directory visibility, mentoring and any published outcome story.'],
    measures: ['Meaningful participation and repeat helpful exchanges / opted-in members, not account counts.', 'Mentoring follow-through, safety reports and voluntary collaboration outcomes.'],
    boundary: 'No existing alumni directory, active mentoring scheme, referral entitlement or established network is being claimed.',
  },
  {
    id: 'outcomes-evidence', title: 'Evidence of value, including what did not work', status: 'proposal', stage: 'foundation', owner: 'Academic quality lead',
    problem: 'A long feature list and selective success stories can hide weak learning, dropouts or an offer students would not choose again.',
    outcome: 'Students and IRIP leaders can judge the offer using transparent evidence rather than promotional claims.',
    scope: ['A small supervised pilot of one focused path before adding more products or scaling paid membership.', 'Track learning, completion, support quality, costs, accessibility and reasons for disengagement.', 'Publish aggregate findings and limitations; use optional, separately consented stories without implying accreditation.'],
    launchGates: ['An evaluation plan, baseline tasks and denominators agreed before recruiting a pilot.', 'Privacy review, meaningful consent and enough aggregation to avoid identifying individuals.', 'A decision owner willing to revise content, support or pricing if the pilot does not deliver.'],
    measures: ['Before/after skill evidence, all-started completion and support turnaround, with missing data disclosed.', 'Voluntary willingness-to-pay or renew feedback and cost-to-serve; no fabricated ROI or placement rate.'],
    boundary: 'No measured learning gain, satisfaction rate, placement rate or return on the proposed fee is asserted today.',
  },
];

export const demoValueTools: readonly { to: string; title: string; boundary: string }[] = [
  { to: '/courses', title: 'Recorded-course preview', boundary: 'Synthetic syllabi only. No streaming or paid membership.' },
  { to: '/app/scholarships', title: 'Scholarship planner', boundary: 'Local profile and tracking tools. Suggestions use degree and destination, not verified eligibility.' },
  { to: '/projects', title: 'Project workflow preview', boundary: 'Synthetic projects, not a promise of supervision or research authorship.' },
  { to: '/internships', title: 'Internship board framework', boundary: 'Starts empty. Listings need approved hosts and publication checks; a page is not a placement service.' },
];
