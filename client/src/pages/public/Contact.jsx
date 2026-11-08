import { usePublicPage, usePublicSite } from '../../components/home/publicContent';
import { ContactView } from '../../components/home/PageViews';

// Heading/intro from Admin → Website content → Pages → Contact; details from Site details.
// The built-in text shows while loading or if the request fails, so the form always works.
export default function Contact() {
  const { page, unpublished } = usePublicPage('contact');
  const { site } = usePublicSite();
  return <ContactView page={page} site={site} unpublished={unpublished} />;
}
