import { usePublicPage } from '../../components/home/publicContent';
import { PageUnavailable } from '../../components/home/PublicPageParts';
import { FaqView } from '../../components/home/PageViews';

// Questions are edited in Admin → Website content → Pages. The built-in text shows
// while loading or if the request fails, so the page never appears broken.
export default function FAQ() {
  const { page, loading, unpublished } = usePublicPage('faq');
  if (unpublished) return <PageUnavailable />;
  return <FaqView page={page} busy={loading} />;
}
