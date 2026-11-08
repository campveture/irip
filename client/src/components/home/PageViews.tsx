/**
 * Public content pages as pure views (props in, markup out). The thin pages in
 * pages/public/{About,FAQ,HowItWorks,Policy,Contact}.jsx load the published text
 * and render these; the admin Pages editor renders the same views with the draft.
 * EditSpot targets ("page-title", "page-para-N", "page-step-N", "page-q-N") match
 * the editor sections in admin/website/WebsiteContent.tsx and render nothing on
 * the public site.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, HelpCircle } from 'lucide-react';
import { Card as CardJs, CardContent as CardContentJs } from '../Card';
import { PageHeader as PageHeaderJs } from '../PageHeader';
import { Alert } from '../Alert';
import { PublicHero } from '../shared/PublicHero';
import { EditSpot, useInPreview } from '../admin/preview/PreviewKit';
import { api } from '../../lib/api';
import { demoImages } from '../../lib/demoImages';
import type { PublicPage, SiteDetails } from './publicContent';

// The shared Card / PageHeader components are untyped .jsx; describe the props used here.
const Card = CardJs as unknown as (props: { hover?: boolean; className?: string; children: ReactNode }) => JSX.Element;
const CardContent = CardContentJs as unknown as (props: { className?: string; children: ReactNode }) => JSX.Element;
const PageHeader = PageHeaderJs as unknown as (props: { title: string; subtitle?: string; icon?: unknown }) => JSX.Element;

type PageContent = Pick<PublicPage, 'title' | 'paragraphs' | 'steps' | 'questions'>;

const TitleSpot = ({ children }: { children: ReactNode }) => <EditSpot target="page-title" label="page title">{children}</EditSpot>;

// ---------- FAQ ----------
export function FaqView({ page, busy }: { page: PageContent; busy?: boolean }) {
  return (
    <div className="irip-public-detail container-page py-8 animate-fade-in" aria-busy={busy}>
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <TitleSpot><PageHeader title={page.title} subtitle="Answers to common questions" icon={HelpCircle} /></TitleSpot>
      <div className="space-y-4">
        {page.questions.map((p, i) => (
          <EditSpot key={i} target={`page-q-${i}`} label={`question ${i + 1}`}>
            <Card hover>
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-start gap-2">
                  <span className="text-brand-600">Q.</span> {p.question}
                </h3>
                <p className="whitespace-pre-line text-sm text-slate-600 leading-relaxed pl-6">{p.answer}</p>
              </CardContent>
            </Card>
          </EditSpot>
        ))}
      </div>
    </div>
  );
}

// ---------- How it works ----------
export function HowItWorksView({ page, busy }: { page: PageContent; busy?: boolean }) {
  return (
    <div className="container-page py-8" aria-busy={busy}>
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-block mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <TitleSpot><h1 className="irip-page-title text-slate-900 mb-6">{page.title}</h1></TitleSpot>
      <figure className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={demoImages.study} alt="" width="1000" height="667" className="aspect-[2/1] w-full object-cover" /><figcaption className="px-4 py-2 text-xs text-slate-500">Learn, discuss, put it into practice. / Stock demo scene</figcaption></figure>
      <Card>
        <CardContent className="p-6">
          {page.steps.map((step, i) => (
            <EditSpot key={`step-${i}`} target={`page-step-${i}`} label={`step ${i + 1}`}>
              <p className="text-slate-600 leading-relaxed mb-3 last:mb-0">
                {i + 1}. {step.title}. {step.text}
              </p>
            </EditSpot>
          ))}
          {page.paragraphs.map((paragraph, i) => (
            <EditSpot key={`para-${i}`} target={`page-para-${i}`} label={`paragraph ${i + 1}`}>
              <p className="whitespace-pre-line text-slate-600 leading-relaxed mb-3 last:mb-0">
                {paragraph}
              </p>
            </EditSpot>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Policies ----------
export function PolicyView({ page, busy }: { page: PageContent; busy?: boolean }) {
  return (
    <div className="container-page py-8" aria-busy={busy}>
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-block mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <TitleSpot><h1 className="text-2xl font-bold text-slate-900 mb-6">{page.title}</h1></TitleSpot>
      <Card>
        <CardContent className="p-6">
          {page.paragraphs.map((paragraph, i) => (
            <EditSpot key={i} target={`page-para-${i}`} label={`paragraph ${i + 1}`}>
              <p className="whitespace-pre-line text-slate-600 leading-relaxed mb-3 last:mb-0">
                {paragraph}
              </p>
            </EditSpot>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- About ----------
const learningModel = [
  { title: 'Learn the foundations', body: 'Understand research methods and evidence.' },
  { title: 'Practise with feedback', body: 'Try, discuss and improve your work.' },
  { title: 'Build a project', body: 'Apply your learning to a research project with supervisor guidance.' },
];

/**
 * About page. The story column has its own states (the public page loads it separately):
 * loading, error with Retry, unpublished (short note) or the story itself.
 */
export function AboutView({ page, unpublished = false, loading = false, error = '', onRetry }: { page: PageContent; unpublished?: boolean; loading?: boolean; error?: string; onRetry?: () => void }) {
  const inPreview = useInPreview();
  const paragraphs = page.paragraphs.filter(p => p.trim());
  const [first, ...more] = paragraphs;
  return (
    <main>
      <PublicHero eyebrow="About IRIP" title={<>Curiosity, with<br /><em>somewhere to go.</em></>} description="The Institute of Research, Innovation and Practice is building a place for learners in Bangladesh to turn curiosity into research." shortcuts={[{ to: '#our-approach', detail: 'The idea', label: 'Why we’re building this' }, { to: '/student-value', detail: 'The direction', label: 'Learner roadmap' }, { to: '/teach', detail: 'Get involved', label: 'Explore teaching' }]} actions={<>
              <Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-brand-900 hover:bg-white">Explore programs <ArrowUpRight size={17} aria-hidden="true" /></Link>
              <a href="#our-approach" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/70 px-6 text-sm font-semibold hover:bg-white/10">Our approach</a>
      </>} />

      <section id="our-approach" className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[.7fr_1.3fr]" aria-labelledby="approach-heading">
        <div>
          <h2 id="approach-heading" className="irip-editorial-heading text-slate-900">Learn by doing.</h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">Structured learning. Useful feedback. Work you can explain.</p>
          <img src="/images/irip-falcon-lockup.png" width="1254" height="1254" alt="Institute of Research, Innovation and Practice — woven falcon shield" loading="lazy" className="mt-6 h-auto w-full max-w-sm object-contain" />
        </div>
        <div className="min-w-0" aria-busy={loading}>
          {loading ? <p role="status" className="py-6 text-sm text-slate-600">Loading our story…</p> : error ? <div><p role="alert" className="text-sm leading-7 text-red-800">{error}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-full border border-brand-300 px-5 text-sm font-semibold text-brand-800">Retry about content</button>}</div> : unpublished ? <p className="py-6 text-sm leading-7 text-slate-600">Our story is being updated. Please check back soon.</p> : <article>
            <TitleSpot><h3 className="text-xl font-semibold text-slate-900">{page.title}</h3></TitleSpot>
            {first !== undefined && <EditSpot target="page-para-0" label="paragraph 1"><p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{first}</p></EditSpot>}
            {more.length > 0 && <div className="mt-4 space-y-4">{more.map((paragraph, index) => <EditSpot key={index} target={`page-para-${index + 1}`} label={`paragraph ${index + 2}`}><p className="whitespace-pre-line text-sm leading-7 text-slate-600">{paragraph}</p></EditSpot>)}</div>}
          </article>}
        </div>
      </section>

      <section className="border-y border-stone py-12" aria-labelledby="learning-model-heading">
        <div className="container-page">
          <h2 id="learning-model-heading" className="text-sm font-semibold uppercase tracking-wider text-brand-700">Our approach</h2>
          <ol className="mt-7 grid gap-8 md:grid-cols-3">{learningModel.map(step => <li key={step.title}><h3 className="text-lg font-semibold text-slate-900">{step.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{step.body}</p></li>)}</ol>
        </div>
      </section>

      <div className="container-page py-12"><aside aria-label="What is available today" className="max-w-2xl text-sm leading-7 text-slate-600"><p>IRIP is being established. Programs and admissions will be announced when they open.</p><p>No guaranteed publication, qualification, internship or job is promised.</p></aside><div className="mt-5 flex flex-wrap gap-6 text-sm font-semibold text-brand-800"><Link to="/teach" className="inline-flex min-h-11 items-center hover:underline">Explore teaching</Link><Link to="/student-value" className="inline-flex min-h-11 items-center hover:underline">Learner roadmap</Link></div></div>
    </main>
  );
}

// ---------- Contact ----------
/** Email / phone / address as shown on the Contact page. `editable` adds the Site details EditSpot. */
export function ContactDetails({ site, editable = false }: { site: SiteDetails; editable?: boolean }) {
  if (!(site.contact_email || site.contact_phone || site.address)) {
    return editable ? <EditSpot target="site-contact" label="contact details"><p className="mt-4 text-sm italic text-slate-500">No email, phone or address is shown (all three are blank).</p></EditSpot> : null;
  }
  const list = <dl className="mt-4 grid gap-1 text-sm text-slate-700">
    {site.contact_email && <div><dt className="inline font-semibold">Email: </dt><dd className="inline"><a href={`mailto:${site.contact_email}`} className="text-brand-700 underline">{site.contact_email}</a></dd></div>}
    {site.contact_phone && <div><dt className="inline font-semibold">Phone: </dt><dd className="inline"><a href={`tel:${site.contact_phone.replace(/[^0-9+]/g, '')}`} className="text-brand-700 underline">{site.contact_phone}</a></dd></div>}
    {site.address && <div><dt className="inline font-semibold">Address: </dt><dd className="inline whitespace-pre-line">{site.address}</dd></div>}
  </dl>;
  return editable ? <EditSpot target="site-contact" label="contact details">{list}</EditSpot> : list;
}

function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const inPreview = useInPreview();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inPreview) return; // the editor preview never sends anything
    setSending(true);
    setError('');
    try {
      await api.post('/public/inquiries', { name: name.trim(), email: email.trim(), message: message.trim(), consent });
      setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'The inquiry could not be sent.'); }
    finally { setSending(false); }
  }

  return <div className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
    {sent ? <div role="status"><h2 className="text-xl font-semibold text-slate-900">Inquiry saved</h2><p className="mt-2 text-slate-600">Your message is now in the local demo inquiry queue.</p><button onClick={() => { setSent(false); setMessage(''); }} className="mt-4 text-sm font-semibold text-brand-700 underline">Send another question</button></div> : <>
      {error && <div className="mb-5"><Alert type="error">{error}</Alert></div>}
      <form className="space-y-5" onSubmit={submit}>
        <div><label htmlFor="contact-name" className="block text-sm font-medium text-slate-800">Name</label><input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div>
        <div><label htmlFor="contact-email" className="block text-sm font-medium text-slate-800">Email</label><input id="contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div>
        <div><label htmlFor="contact-message" className="block text-sm font-medium text-slate-800">Question</label><textarea id="contact-message" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={4000} rows={6} className="mt-2 w-full rounded-md border border-slate-300 p-3 focus:border-brand-600 focus:outline-none" /></div>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /><span>I agree to store this inquiry in the local demo so the team can review it. This does not opt me into marketing messages.</span></label>
        <button disabled={sending} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Saving…' : 'Send inquiry'}</button>
      </form>
    </>}
  </div>;
}

/**
 * The Contact page. When the editable heading/intro is unpublished, a plain heading
 * is shown instead but the inquiry form and contact details stay available.
 */
export function ContactView({ page, site, unpublished = false, editableDetails = false }: { page: PageContent; site: SiteDetails; unpublished?: boolean; editableDetails?: boolean }) {
  return <div className="container-page py-12">
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Contact</p>
      {unpublished ? <h1 className="mt-2 text-3xl font-bold text-slate-900">Send us a question</h1> : <>
        <TitleSpot><h1 className="mt-2 text-3xl font-bold text-slate-900">{page.title}</h1></TitleSpot>
        {page.paragraphs.map((paragraph, index) => <EditSpot key={index} target={`page-para-${index}`} label={`paragraph ${index + 1}`}><p className="mt-3 whitespace-pre-line text-slate-600">{paragraph}</p></EditSpot>)}
      </>}
      <ContactDetails site={site} editable={editableDetails} />
      <p className="mt-2 text-sm text-slate-600">Already learning with us? <Link to="/app/support" className="font-semibold text-brand-700 underline">Open a support ticket</Link>.</p>
    </div>
    <figure className="mt-8 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={demoImages.writing} alt="" width="1200" height="800" className="aspect-[2/1] w-full object-cover" /><figcaption className="px-4 py-2 text-xs text-slate-500">Put your question into words. / Stock photo</figcaption></figure>
    <ContactForm />
  </div>;
}

/** Picks the public view a page key uses (the admin preview renders exactly this). */
export function PublicPageView({ pageKey, page, site }: { pageKey: string; page: PageContent; site: SiteDetails }) {
  if (pageKey === 'about') return <AboutView page={page} />;
  if (pageKey === 'faq') return <FaqView page={page} />;
  if (pageKey === 'how-it-works') return <HowItWorksView page={page} />;
  if (pageKey === 'contact') return <ContactView page={page} site={site} />;
  return <PolicyView page={page} />;
}
