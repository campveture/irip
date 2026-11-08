import { usePublicPage } from '../../components/home/publicContent';
import { PageUnavailable } from '../../components/home/PublicPageParts';
import { HowItWorksView } from '../../components/home/PageViews';

// Steps are edited in Admin → Website content → Pages; built-in text is the fallback.
export default function HowItWorks() {
  const { page, loading, unpublished } = usePublicPage('how-it-works');
  if (unpublished) return <PageUnavailable />;
  return <HowItWorksView page={page} busy={loading} />;
}
