// Locally hosted design assets. Stock people are explicitly labelled models, not real IRIP members.
export const demoImages = {
  study: '/images/digital-learning.jpg',
  mentoring: '/images/team-workshop.jpg',
  team: '/images/team-workshop.jpg',
  writing: '/images/writing-desk.jpg',
  data: '/images/data-analysis.jpg',
  portrait: '/images/mentor-professional.jpg',
  research: '/images/program-research.svg',
  statistics: '/images/program-statistics.svg',
  publication: '/images/program-writing.svg',
};

export function programImage(program = {}) {
  const topic = `${program.slug || ''} ${program.title || ''} ${program.domain || ''}`.toLowerCase();
  if (/statistic|data|quantitative|analysis/.test(topic)) return demoImages.statistics;
  if (/writ|publication|publish|editorial/.test(topic)) return demoImages.publication;
  return demoImages.research;
}

export function projectImage(project = {}) {
  const topic = `${project.title || ''} ${project.summary || ''}`.toLowerCase();
  if (/data|health|statistic|analysis/.test(topic)) return demoImages.data;
  if (/writ|publication|literature/.test(topic)) return demoImages.writing;
  return demoImages.team;
}
