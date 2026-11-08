import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, ResourceView, cardClass } from '../AdminShared';
import { EditorWithPreview } from '../preview/PreviewKit';
import { HomeView, useHomePrograms } from '../../home/HomeView';
import { PublicPageView } from '../../home/PageViews';
import { usePublicSite } from '../../home/publicContent';
import {
  LIMITS, dhakaDateTime, isDirty, pagePayload, parseHomeDocument, parsePageDocument, parsePageList, parseSiteDocument,
  pageActionBlocks, validateHome, validatePage, validateSite, versionStatus, type ContentDocument, type DocumentData, type Errors, type HomeContent, type PageBody, type Revision, type SiteDetails,
} from './websiteModel';
import { SitePreview } from './WebsitePreviews';
import { DISCARD_PROMPT, EditTarget, Field, ListEditor, RevisionHistory, SaveBar, Section, StatusBadge, VersionBadge, ViewOnSite, errorFor, useUnsavedGuard } from './WebsiteFields';

type Tab = 'home' | 'pages' | 'site';
const TABS: { key: Tab; label: string }[] = [{ key: 'home', label: 'Homepage' }, { key: 'pages', label: 'Pages' }, { key: 'site', label: 'Site details' }];

export default function WebsiteContent() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = requested === 'pages' || requested === 'site' ? requested : 'home';
  const pageKey = tab === 'pages' ? params.get('page') : null;
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  const go = useCallback((next: Tab, page?: string) => {
    if (dirty && !window.confirm(DISCARD_PROMPT)) return;
    setDirty(false);
    const search = new URLSearchParams({ tab: next });
    if (page) search.set('page', page);
    setParams(search);
  }, [dirty, setParams]);

  return <AdminPage eyebrow="Website" title="Website content" intro="Change the words visitors see on the public website. Edit a field (or press an “Edit” button on the preview), then save — no code or special formatting needed.">
    <div role="tablist" aria-label="Website content areas" className="flex flex-wrap gap-2">
      {TABS.map(t => <button key={t.key} type="button" role="tab" id={`website-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="website-panel" onClick={() => tab !== t.key && go(t.key)}
        className={`min-h-11 rounded-full px-5 text-sm font-semibold ${tab === t.key ? 'bg-brand-900 text-white' : 'border border-brand-200 bg-white text-brand-900 hover:bg-brand-50'}`}>{t.label}</button>)}
    </div>
    <div id="website-panel" role="tabpanel" aria-labelledby={`website-tab-${tab}`} className="space-y-6">
      {tab === 'home' && <HomeEditor onDirty={setDirty} />}
      {tab === 'site' && <SiteEditor onDirty={setDirty} />}
      {tab === 'pages' && (pageKey ? <PageEditor key={pageKey} pageKey={pageKey} onDirty={setDirty} onBack={() => go('pages')} /> : <PageList onOpen={key => go('pages', key)} />)}
    </div>
    <aside className={`${cardClass} grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center`}>
      <div>
        <h2 className="text-base font-semibold text-brand-950">Events, resources & stories</h2>
        <p className="mt-1 text-sm text-slate-600">News-style items (events, resources, stories, ideas, internships and partners) are managed on their own screen.</p>
      </div>
      <Link to="/admin/content" className={`${secondaryClass} gap-2`}>Open events, resources & stories <ArrowRight size={16} aria-hidden="true" /></Link>
    </aside>
    <p className="text-xs leading-5 text-slate-500">Fixed for compliance and not editable here: the demo disclaimer at the bottom of every page, the stock-photo captions, and the site navigation menus.</p>
  </AdminPage>;
}

// ---------- shared editor plumbing ----------
interface Outcome { message: string; error: string; conflict: boolean }
const EMPTY: Outcome = { message: '', error: '', conflict: false };

/** Loads a document, runs commands, and keeps the "Saved" / error message across reloads. */
function useDocument<T>(path: string, parse: (value: unknown) => DocumentData<T>) {
  const { state, setState, reload } = useAccountResource(path, parse);
  const [outcome, setOutcome] = useState<Outcome>(EMPTY);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (command: () => Promise<unknown>, success: string) => {
    setBusy(true); setOutcome(EMPTY);
    try {
      const data = parse(await command());
      setState({ status: 'ready', data });
      setOutcome({ ...EMPTY, message: success });
      return true;
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status: unknown }).status : null;
      setOutcome({ message: '', error: errorMessage(error), conflict: status === 409 });
      return false;
    } finally { setBusy(false); }
  }, [parse, setState]);
  const reloadLatest = useCallback(() => { setOutcome(EMPTY); reload(); }, [reload]);
  const clearMessage = useCallback(() => setOutcome(current => (current.message ? EMPTY : current)), []);
  return { state, reload: reloadLatest, run, busy, outcome, clearMessage };
}
type DocHandle<T> = ReturnType<typeof useDocument<T>>;

/**
 * Reports the form's unsaved state to the screen (for the leave guard), clears it when the
 * form goes away (e.g. a reload after a conflict), and hides a stale "Saved" once editing resumes.
 */
function useDirtyReport(dirty: boolean, onDirty: (dirty: boolean) => void, clearMessage: () => void) {
  useEffect(() => { onDirty(dirty); if (dirty) clearMessage(); }, [dirty, onDirty, clearMessage]);
  useEffect(() => () => onDirty(false), [onDirty]);
}

function OutcomeBanner({ outcome, onReload }: { outcome: Outcome; onReload: () => void }) {
  if (outcome.message) return <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{outcome.message}</p>;
  if (!outcome.error) return null;
  return <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
    <p>{outcome.error} {!outcome.conflict && 'Your edits are still here — fix the problem and save again.'}</p>
    {outcome.conflict && <button type="button" onClick={onReload} className={`${secondaryClass} mt-2`}>Load the latest version (your edits will be lost)</button>}
  </div>;
}

/** Header: title, Draft / Published / Changes-not-yet-published badge, and what visitors see now. */
function EditorHeader({ title, doc, kind, unsaved, path, children }: { title: string; doc: ContentDocument<unknown>; kind: 'home' | 'site' | 'page'; unsaved: boolean; path: string; children?: ReactNode }) {
  const status = versionStatus(doc, kind, unsaved);
  return <header className={`${cardClass} space-y-3`}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold text-brand-950">{title}</h2><VersionBadge tone={status.tone} label={status.badge} /></div>
        <p className="mt-1 text-xs text-slate-600">Last changed {dhakaDateTime(doc.updated_at)} Bangladesh time{doc.updated_by_name ? ` by ${doc.updated_by_name}` : ''}.</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}<ViewOnSite path={path} label="View live page" /></div>
    </div>
    <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800"><strong>What visitors see now:</strong> {status.visitors}</p>
  </header>;
}

/** The preview frame: same public components, unsaved draft, and a note on which version it shows. */
function Preview({ editor, preview, note, path }: { editor: ReactNode; preview: ReactNode; note: string; path: string }) {
  return <EditorWithPreview editor={editor} preview={<div data-website-preview>{preview}</div>} previewNote={`${note} Click any “Edit” button to jump to that field.`} viewOnSite={path} />;
}

const countErrors = (errors: Errors) => Object.keys(errors).length;
const confirmRestore = (dirty: boolean, extra: string) => window.confirm(`${dirty ? 'Your unsaved changes will be lost. ' : ''}Restore this earlier version? ${extra}`);
const confirmDiscard = () => window.confirm('Discard your unsaved changes?');

// ---------- Homepage ----------
function HomeEditor({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const doc = useDocument('/admin/website/home', parseHomeDocument);
  return <ResourceView state={doc.state} reload={doc.reload} label="homepage text">
    {data => <HomeForm key={data.document.version} data={data} doc={doc} onDirty={onDirty} />}
  </ResourceView>;
}

function HomeForm({ data, doc, onDirty }: { data: DocumentData<HomeContent>; doc: DocHandle<HomeContent>; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<HomeContent>(data.document.content);
  const [showErrors, setShowErrors] = useState(false);
  const dirty = isDirty(draft, data.document.content);
  useDirtyReport(dirty, onDirty, doc.clearMessage);
  const catalog = useHomePrograms();
  const paths = useMemo(() => data.link_options.map(o => o.path), [data.link_options]);
  const errors = useMemo(() => validateHome(draft, paths), [draft, paths]);
  const err = (key: string) => errorFor(errors, showErrors, key);
  const hero = (patch: Partial<HomeContent['hero']>) => setDraft(d => ({ ...d, hero: { ...d.hero, ...patch } }));
  const section = <K extends 'catalog' | 'journey' | 'faq'>(key: K, patch: Partial<HomeContent[K]>) => setDraft(d => ({ ...d, [key]: { ...d[key], ...patch } }));
  const status = versionStatus(data.document, 'home', dirty);

  const save = () => {
    setShowErrors(true);
    if (countErrors(errors)) return;
    void doc.run(() => api.patch('/admin/website/home', { content: draft, version: data.document.version }), 'Saved. The homepage now shows your changes.');
  };
  const restore = (revision: Revision) => {
    if (!confirmRestore(dirty, 'It goes live on the homepage straight away.')) return;
    void doc.run(() => api.post('/admin/website/home/restore', { revision_id: revision.id, version: data.document.version }), 'Earlier version restored. The homepage now shows it.');
  };

  const editor = <div className="space-y-6">
    <Section target="home-hero" title="Top of the page" intro="The large green area visitors see first.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="hero-eyebrow" label="Small heading above the headline" value={draft.hero.eyebrow} onChange={v => hero({ eyebrow: v })} max={LIMITS.eyebrow} required error={err('hero.eyebrow')} />
        <Field id="hero-headline" label="Headline" value={draft.hero.headline} onChange={v => hero({ headline: v })} max={LIMITS.headline} required error={err('hero.headline')} />
        <Field id="hero-emphasis" label="Headline second line (shown in italics)" value={draft.hero.headline_emphasis} onChange={v => hero({ headline_emphasis: v })} max={LIMITS.headline} help="Optional." error={err('hero.headline_emphasis')} />
        <Field id="hero-lead" label="Introduction sentence" value={draft.hero.lead} onChange={v => hero({ lead: v })} max={LIMITS.lead} required error={err('hero.lead')} />
      </div>
      <EditTarget target="home-buttons" className="grid gap-4 md:grid-cols-2">
        <Field id="hero-primary" label="Main button label (opens Programs)" value={draft.hero.primary_button} onChange={v => hero({ primary_button: v })} max={LIMITS.button} required error={err('hero.primary_button')} />
        <Field id="hero-secondary" label="Second button label (scrolls to “How it works”)" value={draft.hero.secondary_button} onChange={v => hero({ secondary_button: v })} max={LIMITS.button} required error={err('hero.secondary_button')} />
      </EditTarget>
      <ListEditor legend="Shortcut cards (up to 3)" items={draft.hero.shortcuts} onChange={shortcuts => hero({ shortcuts })} min={1} max={LIMITS.shortcutsMax} error={err('hero.shortcuts')}
        addLabel="Add a shortcut card" itemLabel={i => `Shortcut ${i + 1}`} itemTarget={i => `home-shortcut-${i}`} newItem={() => ({ detail: '', label: '', link: '/programs' })}
        render={(item, i, update) => <div className="grid gap-3 md:grid-cols-3">
          <Field id={`shortcut-${i}-detail`} label="Small text" value={item.detail} onChange={v => update({ ...item, detail: v })} max={LIMITS.shortcutDetail} required error={err(`hero.shortcuts.${i}.detail`)} />
          <Field id={`shortcut-${i}-label`} label="Title" value={item.label} onChange={v => update({ ...item, label: v })} max={LIMITS.shortcutLabel} required error={err(`hero.shortcuts.${i}.label`)} />
          <div>
            <label htmlFor={`shortcut-${i}-link`} className="text-sm font-semibold text-slate-900">Opens this page<span className="text-red-700" aria-hidden="true"> *</span></label>
            <select id={`shortcut-${i}-link`} value={item.link} onChange={e => update({ ...item, link: e.target.value })} className={fieldClass}>
              {!paths.includes(item.link) && <option value={item.link}>Choose a page…</option>}
              {data.link_options.map(o => <option key={o.path} value={o.path}>{o.label}</option>)}
            </select>
            {err(`hero.shortcuts.${i}.link`) && <p className="mt-1 text-xs font-semibold text-red-800">{err(`hero.shortcuts.${i}.link`)}</p>}
          </div>
        </div>} />
    </Section>

    <Section target="home-catalog" title="Programs section" intro="Above the three program cards. The cards themselves come from Programs.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="catalog-heading" label="Heading" value={draft.catalog.heading} onChange={v => section('catalog', { heading: v })} max={LIMITS.heading} required error={err('catalog.heading')} />
        <Field id="catalog-link" label="Link label (opens all programs)" value={draft.catalog.link_label} onChange={v => section('catalog', { link_label: v })} max={LIMITS.linkLabel} required error={err('catalog.link_label')} />
      </div>
      <EditTarget target="home-catalog-empty">
        <Field id="catalog-empty" label="Text shown when no programs are published" value={draft.catalog.empty_text} onChange={v => section('catalog', { empty_text: v })} max={LIMITS.lead} required error={err('catalog.empty_text')} />
      </EditTarget>
    </Section>

    <Section target="home-journey" title="“How it works” section" intro="Numbered steps next to the workshop photo. Numbers and icons are added automatically.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="journey-heading" label="Heading" value={draft.journey.heading} onChange={v => section('journey', { heading: v })} max={LIMITS.heading} required error={err('journey.heading')} />
        <Field id="journey-lead" label="Introduction" value={draft.journey.lead} onChange={v => section('journey', { lead: v })} max={LIMITS.lead} help="Optional." error={err('journey.lead')} />
      </div>
      <ListEditor legend="Steps" items={draft.journey.steps} onChange={steps => section('journey', { steps })} min={1} max={LIMITS.homeStepsMax} error={err('journey.steps')}
        addLabel="Add a step" itemLabel={i => `Step ${i + 1}`} itemTarget={i => `home-step-${i}`} newItem={() => ({ title: '', text: '' })}
        render={(item, i, update) => <>
          <Field id={`home-step-${i}-title`} label="Step title" value={item.title} onChange={v => update({ ...item, title: v })} max={LIMITS.stepTitle} required error={err(`journey.steps.${i}.title`)} />
          <Field id={`home-step-${i}-text`} label="Step text" value={item.text} onChange={v => update({ ...item, text: v })} max={LIMITS.stepText} required multiline rows={2} error={err(`journey.steps.${i}.text`)} />
        </>} />
    </Section>

    <Section target="home-faq" title="Questions section" intro="Short questions with answers that open when clicked. The full list lives on the FAQ page.">
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="faq-eyebrow" label="Small heading" value={draft.faq.eyebrow} onChange={v => section('faq', { eyebrow: v })} max={LIMITS.eyebrow} help="Optional." error={err('faq.eyebrow')} />
        <Field id="faq-heading" label="Heading" value={draft.faq.heading} onChange={v => section('faq', { heading: v })} max={LIMITS.heading} required error={err('faq.heading')} />
        <Field id="faq-link" label="Link label (opens the FAQ page)" value={draft.faq.link_label} onChange={v => section('faq', { link_label: v })} max={LIMITS.linkLabel} required error={err('faq.link_label')} />
      </div>
      <QuestionList base="faq.questions" idPrefix="home-q" items={draft.faq.questions} onChange={questions => section('faq', { questions })} max={LIMITS.homeQuestionsMax} err={err} />
    </Section>

    <SaveBar dirty={dirty} saving={doc.busy} errorCount={showErrors ? countErrors(errors) : 0} onSave={save} onDiscard={() => { if (confirmDiscard()) { setDraft(data.document.content); setShowErrors(false); } }} />
  </div>;

  return <div className="space-y-6">
    <EditorHeader title="Homepage" doc={data.document} kind="home" unsaved={dirty} path="/" />
    <p className="text-sm text-slate-600">Homepage changes go live as soon as you save. The program cards come from Programs; photos and their captions are fixed.</p>
    <OutcomeBanner outcome={doc.outcome} onReload={doc.reload} />
    <Preview editor={editor} note={status.preview} path="/"
      preview={<HomeView home={draft} programs={catalog.programs} loading={catalog.loading} error={catalog.error} />} />
    <RevisionHistory revisions={data.revisions} busy={doc.busy} onRestore={restore} note="Every save is kept. Restoring puts that version back on the homepage." />
  </div>;
}

function QuestionList({ base, idPrefix, items, onChange, max, err }: { base: string; idPrefix: string; items: HomeContent['faq']['questions']; onChange: (items: HomeContent['faq']['questions']) => void; max: number; err: (key: string) => string | undefined }) {
  return <ListEditor legend="Questions and answers" items={items} onChange={onChange} min={1} max={max} error={err(base)}
    addLabel="Add a question" itemLabel={i => `Question ${i + 1}`} itemTarget={i => `${idPrefix}-${i}`} newItem={() => ({ question: '', answer: '' })}
    render={(item, i, update) => <>
      <Field id={`${idPrefix}-${i}-question`} label="Question" value={item.question} onChange={v => update({ ...item, question: v })} max={LIMITS.question} required error={err(`${base}.${i}.question`)} />
      <Field id={`${idPrefix}-${i}-answer`} label="Answer" value={item.answer} onChange={v => update({ ...item, answer: v })} max={LIMITS.answer} required multiline rows={3} error={err(`${base}.${i}.answer`)} />
    </>} />;
}

// ---------- Site details ----------
function SiteEditor({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const doc = useDocument('/admin/website/site', parseSiteDocument);
  return <ResourceView state={doc.state} reload={doc.reload} label="site details">
    {data => <SiteForm key={data.document.version} data={data} doc={doc} onDirty={onDirty} />}
  </ResourceView>;
}

function SiteForm({ data, doc, onDirty }: { data: DocumentData<SiteDetails>; doc: DocHandle<SiteDetails>; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<SiteDetails>(data.document.content);
  const [showErrors, setShowErrors] = useState(false);
  const dirty = isDirty(draft, data.document.content);
  useDirtyReport(dirty, onDirty, doc.clearMessage);
  const errors = useMemo(() => validateSite(draft), [draft]);
  const err = (key: string) => errorFor(errors, showErrors, key);
  const set = (patch: Partial<SiteDetails>) => setDraft(d => ({ ...d, ...patch }));
  const status = versionStatus(data.document, 'site', dirty);
  const save = () => {
    setShowErrors(true);
    if (countErrors(errors)) return;
    void doc.run(() => api.patch('/admin/website/site', { content: draft, version: data.document.version }), 'Saved. The footer and contact page now show these details.');
  };
  const restore = (revision: Revision) => {
    if (!confirmRestore(dirty, 'It goes live straight away.')) return;
    void doc.run(() => api.post('/admin/website/site/restore', { revision_id: revision.id, version: data.document.version }), 'Earlier version restored. The footer and contact page now show it.');
  };
  const editor = <div className="space-y-6">
    <Section target="site-identity" title="Name and description">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="site-name" label="Short site name" value={draft.site_name} onChange={v => set({ site_name: v })} max={LIMITS.siteName} required error={err('site_name')} />
        <Field id="site-tagline" label="Full name" value={draft.tagline} onChange={v => set({ tagline: v })} max={LIMITS.tagline} required error={err('tagline')} />
      </div>
      <Field id="site-blurb" label="Footer description" value={draft.footer_blurb} onChange={v => set({ footer_blurb: v })} max={LIMITS.footerBlurb} multiline help="Optional." error={err('footer_blurb')} />
      <EditTarget target="site-notes" className="grid gap-4 md:grid-cols-2">
        <Field id="site-note" label="Footer bottom line" value={draft.footer_note} onChange={v => set({ footer_note: v })} max={LIMITS.footerNote} help="Optional." error={err('footer_note')} />
        <Field id="site-note-2" label="Footer second bottom line" value={draft.footer_secondary_note} onChange={v => set({ footer_secondary_note: v })} max={LIMITS.footerNote} help="Optional." error={err('footer_secondary_note')} />
      </EditTarget>
    </Section>
    <Section target="site-contact" title="Contact details" intro="Shown in the footer and on the Contact page. Only enter details that are real and monitored. Leave a field blank to hide it.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="site-email" label="Contact email" value={draft.contact_email} onChange={v => set({ contact_email: v })} max={LIMITS.email} help="Optional, e.g. hello@example.com." error={err('contact_email')} />
        <Field id="site-phone" label="Phone" value={draft.contact_phone} onChange={v => set({ contact_phone: v })} max={LIMITS.phone} help="Optional." error={err('contact_phone')} />
      </div>
      <Field id="site-address" label="Address" value={draft.address} onChange={v => set({ address: v })} max={LIMITS.address} multiline rows={2} help="Optional." error={err('address')} />
    </Section>
    <Section target="site-social" title="Social media links" intro="Shown in the footer’s Contact column.">
      <ListEditor legend="Links" items={draft.social_links} onChange={social_links => set({ social_links })} max={LIMITS.socialMax} error={err('social_links')}
        addLabel="Add a link" itemLabel={i => `Link ${i + 1}`} itemTarget={i => `site-social-${i}`} newItem={() => ({ label: '', url: 'https://' })}
        render={(item, i, update) => <div className="grid gap-3 md:grid-cols-2">
          <Field id={`social-${i}-label`} label="Name (e.g. LinkedIn)" value={item.label} onChange={v => update({ ...item, label: v })} max={LIMITS.socialLabel} required error={err(`social_links.${i}.label`)} />
          <Field id={`social-${i}-url`} label="Web address" value={item.url} onChange={v => update({ ...item, url: v })} max={LIMITS.socialUrl} required help="Starts with https://." error={err(`social_links.${i}.url`)} />
        </div>} />
    </Section>
    <SaveBar dirty={dirty} saving={doc.busy} errorCount={showErrors ? countErrors(errors) : 0} onSave={save} onDiscard={() => { if (confirmDiscard()) { setDraft(data.document.content); setShowErrors(false); } }} />
  </div>;
  return <div className="space-y-6">
    <EditorHeader title="Site details" doc={data.document} kind="site" unsaved={dirty} path="/contact" />
    <p className="text-sm text-slate-600">Used in the footer of every page and on the Contact page. Changes go live when you save.</p>
    <OutcomeBanner outcome={doc.outcome} onReload={doc.reload} />
    <Preview editor={editor} note={status.preview} path="/contact" preview={<SitePreview site={draft} />} />
    <RevisionHistory revisions={data.revisions} busy={doc.busy} onRestore={restore} note="Every save is kept. Restoring puts that version back on the site." />
  </div>;
}

// ---------- Pages ----------
function PageList({ onOpen }: { onOpen: (key: string) => void }) {
  const { state, reload } = useAccountResource('/admin/website/pages', parsePageList);
  return <ResourceView state={state} reload={reload} label="pages">
    {pages => <div className="space-y-3">
      <p className="text-sm text-slate-600">Saving a page keeps it as a draft. Visitors only see it after you press <strong>Publish</strong>. Policies stay hidden behind a “not yet approved” notice until they are published.</p>
      {pages.length === 0 ? <p className={cardClass}>No pages are set up yet. Restart the server to create the standard pages.</p> : <ul className="grid gap-3 md:grid-cols-2">
        {pages.map(p => <li key={p.key} className={`${cardClass} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><h2 className="text-base font-semibold text-brand-950">{p.label}</h2><p className="text-sm text-slate-600">{p.title}</p></div>
            <StatusBadge status={p.status} hasChanges={p.has_unpublished_changes} />
          </div>
          <p className="text-xs text-slate-500">{p.is_policy ? 'Policy · ' : ''}{p.format === 'faq' ? 'Questions and answers' : p.format === 'steps' ? 'Numbered steps' : 'Paragraphs'} · changed {dhakaDateTime(p.updated_at)}{p.updated_by_name ? ` by ${p.updated_by_name}` : ''}</p>
          <div className="mt-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpen(p.key)} className={actionClass}>Edit<span className="sr-only"> {p.label}</span></button>
            <ViewOnSite path={p.public_path} />
          </div>
        </li>)}
      </ul>}
    </div>}
  </ResourceView>;
}

function PageEditor({ pageKey, onDirty, onBack }: { pageKey: string; onDirty: (dirty: boolean) => void; onBack: () => void }) {
  const doc = useDocument(`/admin/website/pages/${encodeURIComponent(pageKey)}`, parsePageDocument);
  return <div className="space-y-4">
    <button type="button" onClick={onBack} className={`${secondaryClass} gap-2`}><ArrowLeft size={16} aria-hidden="true" /> All pages</button>
    <ResourceView state={doc.state} reload={doc.reload} label="page">
      {data => <PageForm key={data.document.version} data={data} doc={doc} onDirty={onDirty} />}
    </ResourceView>
  </div>;
}

function PageForm({ data, doc, onDirty }: { data: DocumentData<PageBody>; doc: DocHandle<PageBody>; onDirty: (dirty: boolean) => void }) {
  const d = data.document;
  const [title, setTitle] = useState(d.title);
  const [body, setBody] = useState<PageBody>(d.content);
  const [showErrors, setShowErrors] = useState(false);
  const dirty = title !== d.title || isDirty(body, d.content);
  useDirtyReport(dirty, onDirty, doc.clearMessage);
  const { site } = usePublicSite(); // published contact details, shown on the Contact page preview
  const errors = useMemo(() => validatePage(d.format, title, body), [d.format, title, body]);
  const err = (key: string) => errorFor(errors, showErrors, key);
  const path = `/admin/website/pages/${encodeURIComponent(d.key)}`;
  const status = versionStatus(d, 'page', dirty);
  const blocked = pageActionBlocks(d, dirty);

  const save = () => {
    setShowErrors(true);
    if (countErrors(errors)) return;
    void doc.run(() => api.patch(path, { title, content: pagePayload(d.format, body), version: d.version }),
      d.status === 'published' ? 'Draft saved. Visitors still see the published version until you press Publish.' : 'Draft saved. It is not on the site until you publish it.');
  };
  const publish = () => {
    const warning = d.is_policy ? 'Publishing makes this the official policy on the public website. Only publish text that has been approved. Publish now?' : 'Publish this page so visitors can see it?';
    if (!window.confirm(warning)) return;
    void doc.run(() => api.post(`${path}/publish`, { version: d.version }), 'Published. Visitors now see this version.');
  };
  const unpublish = () => {
    const after = d.is_policy ? 'Visitors will see the “not yet approved” notice instead.'
      : d.key === 'contact' ? 'Visitors will see a plain heading; the inquiry form stays available.'
      : d.key === 'about' ? 'Visitors will see “Our story is being updated” in place of this text.'
      : 'Visitors will see “This page isn’t available right now”.';
    if (!window.confirm(`Unpublish this ${d.is_policy ? 'policy' : 'page'}? ${after}`)) return;
    void doc.run(() => api.post(`${path}/unpublish`, { version: d.version }), 'Unpublished. The page text is no longer shown to visitors.');
  };
  const restore = (revision: Revision) => {
    if (!confirmRestore(dirty, 'It becomes the draft; press Publish to show it to visitors.')) return;
    void doc.run(() => api.post(`${path}/restore`, { revision_id: revision.id, version: d.version }), 'Earlier version restored as the draft. Publish it to show it to visitors.');
  };
  const discard = () => { if (confirmDiscard()) { setTitle(d.title); setBody(d.content); setShowErrors(false); } };

  const editor = <div className="space-y-6">
    <Section target="page-title" title="Page text" intro="Write in plain sentences. Each box becomes its own paragraph; no special formatting is needed.">
      <Field id="page-title" label="Page title" value={title} onChange={setTitle} max={LIMITS.pageTitle} required error={err('title')} />
      {d.format === 'faq' && <QuestionList base="questions" idPrefix="page-q" items={body.questions} onChange={questions => setBody(b => ({ ...b, questions }))} max={LIMITS.pageQuestionsMax} err={err} />}
      {d.format === 'steps' && <ListEditor legend="Steps (numbered automatically)" items={body.steps} onChange={steps => setBody(b => ({ ...b, steps }))} min={1} max={LIMITS.pageStepsMax} error={err('steps')}
        addLabel="Add a step" itemLabel={i => `Step ${i + 1}`} itemTarget={i => `page-step-${i}`} newItem={() => ({ title: '', text: '' })}
        render={(item, i, update) => <>
          <Field id={`page-step-${i}-title`} label="Step title" value={item.title} onChange={v => update({ ...item, title: v })} max={LIMITS.stepTitle} required error={err(`steps.${i}.title`)} />
          <Field id={`page-step-${i}-text`} label="Step text" value={item.text} onChange={v => update({ ...item, text: v })} max={LIMITS.stepText} required multiline rows={2} error={err(`steps.${i}.text`)} />
        </>} />}
      {d.format !== 'faq' && <ListEditor legend={d.format === 'steps' ? 'Closing paragraphs (after the steps)' : 'Paragraphs'} items={body.paragraphs} onChange={paragraphs => setBody(b => ({ ...b, paragraphs }))}
        min={d.format === 'steps' ? 0 : 1} max={d.format === 'steps' ? LIMITS.closingMax : LIMITS.paragraphsMax} error={err('paragraphs')}
        addLabel="Add a paragraph" itemLabel={i => `Paragraph ${i + 1}`} itemTarget={i => `page-para-${i}`} newItem={() => ''}
        render={(item, i, update) => <Field id={`page-para-${i}`} label={`Paragraph ${i + 1} text`} value={item} onChange={update} max={LIMITS.paragraph} required multiline rows={4} error={err(`paragraphs.${i}`)} />} />}
      {d.key === 'about' && <p className="text-xs text-slate-500">The first paragraph is always shown; the rest appear under “More about IRIP”.</p>}
      {d.key === 'contact' && <p className="text-xs text-slate-500">The email, phone and address under this text come from <strong>Site details</strong>.</p>}
    </Section>
    <SaveBar dirty={dirty} saving={doc.busy} errorCount={showErrors ? countErrors(errors) : 0} onSave={save} onDiscard={discard} saveLabel="Save draft">
      <button type="button" onClick={publish} disabled={doc.busy || Boolean(blocked.publish)} aria-describedby={blocked.publish ? 'publish-hint' : undefined} className={actionClass}>Publish</button>
      {blocked.publish && <span id="publish-hint" className="text-xs text-slate-600">{blocked.publish}</span>}
    </SaveBar>
  </div>;

  return <div className="space-y-6">
    <EditorHeader title={d.label} doc={d} kind="page" unsaved={dirty} path={d.public_path}>
      {d.status === 'published' && <button type="button" onClick={unpublish} disabled={doc.busy || Boolean(blocked.unpublish)} title={blocked.unpublish || undefined} className={secondaryClass}>Unpublish</button>}
    </EditorHeader>
    {d.status === 'published' && blocked.unpublish && <p className="text-xs text-slate-600">{blocked.unpublish}</p>}
    {d.is_policy && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This is a policy. Legal text needs approval before it is published. Until you publish it, visitors see the fixed “not yet approved” notice.</p>}
    <OutcomeBanner outcome={doc.outcome} onReload={doc.reload} />
    <Preview editor={editor} note={status.preview} path={d.public_path}
      preview={<PublicPageView pageKey={d.key} page={{ title, paragraphs: body.paragraphs, steps: body.steps, questions: body.questions }} site={site} />} />
    <RevisionHistory revisions={data.revisions} busy={doc.busy} onRestore={restore} note="Every save, publish and restore is kept. Restoring puts that version back as the draft." />
  </div>;
}
