import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { READ_ONLY_PREVIEW } from '../lib/readOnlyPreview';
import { IripMark } from './shared/IripMark';
import { DemoDisclosure } from './shared/DemoNotice';
import { ReadOnlyPreviewNotice } from './shared/ReadOnlyPreview';
import { usePublicSite } from './home/publicContent';
import { EditSpot, useInPreview } from './admin/preview/PreviewKit';

// Name, description, contact details and bottom lines come from Admin → Website content →
// Site details. Navigation columns and the demo disclaimer are fixed.
export function Footer() {
  const { site } = usePublicSite();
  // The About page describes the institute only; it carries no synthetic prices, seats or schedules,
  // so it omits the demonstration notices that the data-bearing pages keep.
  const { pathname } = useLocation();
  return <FooterView site={site} hideDemoNotices={pathname === '/about'} />;
}

/** Pure footer (site details in, markup out); also rendered by the Site details editor preview. */
export function FooterView({ site, hideDemoNotices = false }) {
  const inPreview = useInPreview();
  const hasContact = Boolean(site.contact_email || site.contact_phone || site.address);
  return (
    <footer className="irip-inverse border-t border-brand-800 bg-brand-900 text-inverse mt-auto">
      <div className="container-page py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-8">
          <div className="col-span-2">
            <EditSpot target="site-identity" label="name and description">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 p-2 shadow-lg sm:h-24 sm:w-24">
                <IripMark className="h-full w-full" />
              </div>
              <span className="text-3xl font-semibold tracking-tight text-white">{site.site_name}</span>
            </div>
            <p className="mb-3 text-[13px] font-medium leading-6 text-inverse">{site.tagline}</p>
            {site.footer_blurb && <p className="whitespace-pre-line text-sm text-inverse max-w-xs">
              {site.footer_blurb}
            </p>}
            </EditSpot>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
               <li><Link to="/programs" className="hover:text-white">Programs</Link></li>
               <li><Link to="/courses" className="hover:text-white">Courses</Link></li>
               <li><Link to="/student-value" className="hover:text-white">Learner roadmap</Link></li>
              <li><Link to="/projects" className="hover:text-white">Projects</Link></li>
              <li><Link to="/mentors" className="hover:text-white">Mentors</Link></li>
              <li><Link to={READ_ONLY_PREVIEW ? '/teach' : '/teach/apply'} className="font-semibold text-brand-100 hover:text-white">{READ_ONLY_PREVIEW ? 'Mentor application info' : 'Apply as a mentor'}</Link></li>
              <li><Link to="/about" className="hover:text-white">About</Link></li>
              {!hideDemoNotices && <li><Link to="/demo-guide" className="hover:text-white">Validate the demo</Link></li>}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Learner</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/app" className="hover:text-white">Student Portal</Link></li>
              <li><Link to="/certificates" className="hover:text-white">Certificates</Link></li>
              <li><Link to="/app/support" className="hover:text-white">Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Policy</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/policies/terms" className="hover:text-white">Terms</Link></li>
              <li><Link to="/policies/privacy" className="hover:text-white">Privacy</Link></li>
              <li><Link to="/policies/refund" className="hover:text-white">Refund</Link></li>
              <li><Link to="/policies/integrity" className="hover:text-white">Integrity</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contact" className="hover:text-white">Send an inquiry</Link></li>
              <li><Link to="/certificates" className="flex items-center gap-2 hover:text-white"><ShieldCheck className="h-4 w-4" /> Verify a certificate</Link></li>
              {site.contact_email && <li><EditSpot target="site-contact" label="email"><a href={`mailto:${site.contact_email}`} className="break-all hover:text-white">{site.contact_email}</a></EditSpot></li>}
              {site.contact_phone && <li><EditSpot target="site-contact" label="phone"><a href={`tel:${site.contact_phone.replace(/[^0-9+]/g, '')}`} className="hover:text-white">{site.contact_phone}</a></EditSpot></li>}
              {site.address && <li className="whitespace-pre-line"><EditSpot target="site-contact" label="address">{site.address}</EditSpot></li>}
              {inPreview && !hasContact && <li><EditSpot target="site-contact" label="contact details"><span className="italic text-brand-100">No email, phone or address shown</span></EditSpot></li>}
              {site.social_links.map((link, index) => <li key={`${link.url}-${index}`}><EditSpot target={`site-social-${index}`} label={`link ${index + 1}`}><a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">{link.label}</a></EditSpot></li>)}
              {inPreview && site.social_links.length === 0 && <li><EditSpot target="site-social" label="social links"><span className="italic text-brand-100">No social media links</span></EditSpot></li>}
            </ul>
          </div>
        </div>
        {!hideDemoNotices && <div className="mb-6 max-w-4xl space-y-2 text-brand-100"><DemoDisclosure />{READ_ONLY_PREVIEW && <ReadOnlyPreviewNotice />}</div>}
        <div className="border-t border-white/25 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[13px] text-inverse">
          {site.footer_note && <EditSpot target="site-notes" label="bottom line"><span>{site.footer_note}</span></EditSpot>}
          {site.footer_secondary_note && <EditSpot target="site-notes" label="second bottom line"><span>{site.footer_secondary_note}</span></EditSpot>}
          {inPreview && !site.footer_note && !site.footer_secondary_note && <EditSpot target="site-notes" label="bottom lines"><span className="italic">No bottom lines</span></EditSpot>}
        </div>
      </div>
    </footer>
  );
}
