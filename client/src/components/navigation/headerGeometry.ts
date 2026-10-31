/** The floating header has zero flow height; measure its visible container. */
export function publicHeaderHeight(): number {
  return document.querySelector('.academy-header > .container-page')?.getBoundingClientRect().height || 0;
}
