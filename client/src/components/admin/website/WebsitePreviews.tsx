import { ContactDetails } from '../../home/PageViews';
import { FooterView } from '../../Footer';
import type { SiteDetails } from './websiteModel';

/** Footer + the Contact page's details block, exactly as the public site renders them. */
export function SitePreview({ site }: { site: SiteDetails }) {
  return <div className="flex flex-col bg-canvas">
    <div className="container-page py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On the Contact page</p>
      <div className="max-w-2xl"><ContactDetails site={site} editable /></div>
    </div>
    <p className="container-page pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">At the bottom of every page</p>
    <FooterView site={site} />
  </div>;
}
