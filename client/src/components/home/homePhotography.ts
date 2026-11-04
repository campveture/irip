/** Local stock photography for illustration, never evidence of IRIP people/premises. */
export const homePhotography = {
  hero: {
    src: '/images/home-study-1600.jpg',
    srcSet: '/images/home-study-800.jpg 800w, /images/home-study-1600.jpg 1600w',
    alt: 'Stock photograph of a group studying together around laptops and bookshelves.',
  },
  practice: {
    src: '/images/team-workshop.jpg',
    alt: 'Stock photograph of people discussing work around a table with laptops.',
  },
} as const;

export function homeProgramPhoto(program: { slug?: unknown; title?: unknown; domain?: unknown }) {
  const topic = `${String(program.slug ?? '')} ${String(program.title ?? '')} ${String(program.domain ?? '')}`.toLowerCase();
  if (/statistic|data|quantitative|analysis/.test(topic)) return '/images/data-analysis.jpg';
  if (/writ|publication|publish|editorial/.test(topic)) return '/images/writing-desk.jpg';
  return '/images/digital-learning.jpg';
}
