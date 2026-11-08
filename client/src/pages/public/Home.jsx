import { HomeView, useHomePrograms } from '../../components/home/HomeView';
import { usePublicSite } from '../../components/home/publicContent';

// Thin page: published homepage text (Admin → Website content → Homepage) + the live
// program catalog, rendered by the same HomeView the admin preview uses.
export default function Home() {
  const { home } = usePublicSite();
  const { programs, loading, error } = useHomePrograms();
  return <HomeView home={home} programs={programs} loading={loading} error={error} />;
}
