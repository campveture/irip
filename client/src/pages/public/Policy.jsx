import { useParams } from 'react-router-dom';
import { usePublicPage } from '../../components/home/publicContent';
import { PageUnavailable } from '../../components/home/PublicPageParts';
import { PolicyView } from '../../components/home/PageViews';

// Policies must be explicitly published in Admin → Website content → Pages.
// Until then the server (and this fallback) shows the fixed "not approved" notice.
export default function Policy() {
  const { key = '' } = useParams();
  const { page, loading, unpublished } = usePublicPage(key);
  if (unpublished) return <PageUnavailable />;
  return <PolicyView page={page} busy={loading} />;
}
