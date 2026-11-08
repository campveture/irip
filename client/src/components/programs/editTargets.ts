/**
 * Names of the editor sections that EditSpot buttons on the public program, course and
 * learner views jump to (see components/admin/preview/PreviewKit.tsx). The admin editor
 * puts id={editTargetId(name)} on the matching form field or section.
 */
export const PROGRAM_TARGETS = {
  title: 'program-title', subject: 'program-subject', badge: 'program-badge', summary: 'program-summary', notice: 'program-notice',
  fee: 'program-fee', capacity: 'program-capacity', hours: 'program-hours', study: 'program-study',
} as const;
export const courseTarget = (id: number | string) => `course-${id}`;
export const coursePartTarget = (id: number | string, part: 'title' | 'summary' | 'plan') => `course-${id}-${part}`;
/** Learning-plan blocks: `${prefix}-outcomes`, `-topics`, `-practice`, `-preparation`, `-deliverable`, `-weeks`. */
export const coursePlanPrefix = (id: number | string) => `course-${id}-plan`;
export const moduleTarget = (id: number | string) => `module-${id}`;
export const lessonTarget = (id: number | string) => `lesson-${id}`;
export const assessmentTarget = (id: number | string) => `assessment-${id}`;
