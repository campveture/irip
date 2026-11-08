import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DEFAULT_HOME, DEFAULT_PAGES, DEFAULT_SITE, parsePublicPage, parsePublicSite } from '../src/components/home/publicContent';
import { isDirty, moveItem, pageActionBlocks, pagePayload, parseHomeDocument, parsePageDocument, parsePageList, parseSiteDocument, removeItem, replaceItem, statusLabel, validateHome, validatePage, validateSite, versionStatus } from '../src/components/admin/website/websiteModel';
import * as ReactRuntime from 'react';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { EditorWithPreview } from '../src/components/admin/preview/PreviewKit';
import { HomeView, parseHomePrograms } from '../src/components/home/HomeView';
import { AboutView, ContactView, FaqView, HowItWorksView, PolicyView, PublicPageView } from '../src/components/home/PageViews';
import { FooterView } from '../src/components/Footer';
import { SitePreview } from '../src/components/admin/website/WebsitePreviews';
import { leavesPage } from '../src/components/admin/website/WebsiteFields';

const require = createRequire(import.meta.url);
const server = require('../../server/admin/content-defaults.js') as {
  SITE: unknown; HOME: unknown; PAGES: Record<string, { title: string; format: string; content: Record<string, unknown> }>; POLICY_KEYS: string[]; LINK_OPTIONS: { path: string }[];
};
const paths = server.LINK_OPTIONS.map(o => o.path);
const revision = { id: 1, version: 1, action: 'original', title: '', created_at: '2026-11-08T10:00:00Z', actor_name: 'Original website text' };
const doc = (content: unknown, extra: Record<string, unknown> = {}) => ({
  document: { key: 'home', kind: 'home', label: 'Homepage', format: 'home', public_path: '/', is_policy: false, title: '', content, status: 'published', has_unpublished_changes: false, published_at: null, version: 3, updated_at: '2026-11-08T10:00:00Z', updated_by_name: null, ...extra },
  revisions: [revision], link_options: server.LINK_OPTIONS,
});

test('offline fallbacks match the server seed exactly (the site looks identical before and after the API loads)', () => {
  assert.deepEqual(DEFAULT_SITE, server.SITE);
  assert.deepEqual(DEFAULT_HOME, server.HOME);
  for (const [key, page] of Object.entries(DEFAULT_PAGES)) {
    const seeded = server.PAGES[key];
    assert.ok(seeded, key);
    assert.equal(page.title, seeded.title, key);
    assert.equal(page.format, seeded.format, key);
    assert.equal(page.status, server.POLICY_KEYS.includes(key) ? 'draft' : 'published', key);
    if (seeded.format === 'faq') assert.deepEqual(page.questions, seeded.content.questions);
    if (seeded.format === 'steps') assert.deepEqual(page.steps, seeded.content.steps);
    assert.deepEqual(page.paragraphs, seeded.content.paragraphs ?? []);
  }
  for (const shortcut of DEFAULT_HOME.hero.shortcuts) assert.ok(paths.includes(shortcut.link), shortcut.link);
});

test('public parsers copy known fields only and refuse unsafe links', () => {
  const parsed = parsePublicSite({ site: { ...DEFAULT_SITE, secret: 'x' }, home: DEFAULT_HOME });
  assert.equal(Object.hasOwn(parsed.site, 'secret'), false);
  assert.throws(() => parsePublicSite({ site: { ...DEFAULT_SITE, social_links: [{ label: 'x', url: 'javascript:alert(1)' }] }, home: DEFAULT_HOME }));
  assert.throws(() => parsePublicSite({ site: DEFAULT_SITE, home: { ...DEFAULT_HOME, hero: { ...DEFAULT_HOME.hero, shortcuts: [{ detail: 'a', label: 'b', link: '//evil.example' }] } } }));
  assert.throws(() => parsePublicSite({ site: DEFAULT_SITE, home: { ...DEFAULT_HOME, hero: { ...DEFAULT_HOME.hero, shortcuts: [{ detail: 'a', label: 'b', link: 'https://evil.example' }] } } }));
  const faq = parsePublicPage({ key: 'faq', title: 'FAQ', body: 'Q: a\nA: b', format: 'faq', questions: [{ question: 'a', answer: 'b' }], status: 'published', updated_at: null });
  assert.equal(faq.questions.length, 1);
  assert.deepEqual(faq.steps, []);
  assert.throws(() => parsePublicPage({ key: 'faq', title: 'FAQ', format: 'faq', questions: [], status: 'published' }), 'empty FAQ is treated as a failure → fallback text');
  assert.throws(() => parsePublicPage({ key: 'x', title: 'X', format: 'html', paragraphs: ['a'], status: 'published' }));
  assert.equal(parsePublicPage({ key: 'terms', title: 'T', format: 'paragraphs', paragraphs: ['a'], status: 'draft' }).status, 'draft');
});

test('admin document parsers verify shape and status', () => {
  const home = parseHomeDocument(doc(DEFAULT_HOME));
  assert.equal(home.document.version, 3);
  assert.equal(home.revisions[0]!.action, 'original');
  assert.throws(() => parseHomeDocument(doc(DEFAULT_HOME, { status: 'live' })));
  assert.throws(() => parseHomeDocument({ ...doc(DEFAULT_HOME), revisions: [{ ...revision, action: 'delete' }] }));
  assert.throws(() => parseHomeDocument(doc({ hero: {} })), /could not be verified/);
  assert.equal(parseSiteDocument(doc(DEFAULT_SITE)).document.content.site_name, 'IRIP');
  const page = parsePageDocument(doc({ steps: [{ title: 'a', text: 'b' }], paragraphs: [] }, { format: 'steps' }));
  assert.deepEqual(page.document.content, { paragraphs: [], steps: [{ title: 'a', text: 'b' }], questions: [] });
  const list = parsePageList({ pages: [{ key: 'terms', label: 'Terms', title: 'T', format: 'paragraphs', public_path: '/policies/terms', is_policy: true, status: 'draft', has_unpublished_changes: false, version: 1, updated_at: 'now', updated_by_name: null }] });
  assert.equal(list[0]!.is_policy, true);
  assert.throws(() => parsePageList({ pages: [{ key: 'x' }] }));
});

test('validation mirrors the server rules', () => {
  assert.deepEqual(validateHome(DEFAULT_HOME, paths), {});
  const bad = validateHome({ ...DEFAULT_HOME, hero: { ...DEFAULT_HOME.hero, headline: ' ', lead: 'x'.repeat(241), shortcuts: [{ detail: 'a', label: 'b', link: '/admin' }] } }, paths);
  assert.match(bad['hero.headline']!, /required/);
  assert.match(bad['hero.lead']!, /at most 240/);
  assert.match(bad['hero.shortcuts.0.link']!, /Choose a page/);
  assert.match(validateHome({ ...DEFAULT_HOME, faq: { ...DEFAULT_HOME.faq, questions: [] } }, paths)['faq.questions']!, /at least one/);
  assert.deepEqual(validateSite(DEFAULT_SITE), {});
  const site = validateSite({ ...DEFAULT_SITE, contact_email: 'nope', contact_phone: 'call', social_links: [{ label: '', url: 'http://x.com' }] });
  assert.ok(site.contact_email && site.contact_phone && site['social_links.0.label'] && site['social_links.0.url']);
  assert.deepEqual(validatePage('paragraphs', 'Terms', { paragraphs: ['One.'], steps: [], questions: [] }), {});
  assert.ok(validatePage('paragraphs', 'Terms', { paragraphs: [], steps: [], questions: [] }).paragraphs);
  assert.ok(validatePage('faq', '', { paragraphs: [], steps: [], questions: [{ question: 'Q', answer: '' }] })['questions.0.answer']);
  assert.ok(validatePage('steps', 'How', { paragraphs: [], steps: [{ title: 'a', text: 'b' }], questions: [] }).title === undefined);
  assert.match(validatePage('paragraphs', 'Title', { paragraphs: ['<script>x</script>'], steps: [], questions: [] })['paragraphs.0']!, /code/);
});

test('list helpers, payloads and status labels', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b'], 'cannot move past the top');
  assert.deepEqual(removeItem(['a', 'b', 'c'], 1), ['a', 'c']);
  assert.deepEqual(replaceItem(['a', 'b'], 1, 'z'), ['a', 'z']);
  assert.equal(isDirty({ a: [1] }, { a: [1] }), false);
  assert.equal(isDirty({ a: [1] }, { a: [2] }), true);
  const body = { paragraphs: ['p'], steps: [{ title: 't', text: 'x' }], questions: [{ question: 'q', answer: 'a' }] };
  assert.deepEqual(pagePayload('faq', body), { questions: body.questions });
  assert.deepEqual(pagePayload('steps', body), { steps: body.steps, paragraphs: body.paragraphs });
  assert.deepEqual(pagePayload('paragraphs', body), { paragraphs: body.paragraphs });
  assert.equal(statusLabel({ status: 'draft', has_unpublished_changes: false }), 'Draft — not on the site');
  assert.equal(statusLabel({ status: 'published', has_unpublished_changes: true }), 'Published — changes not yet published');
});

// ---------- live preview views (Phase 3) ----------
// tsx compiles the shared .jsx components (Footer, Card, PageHeader…) with the classic JSX
// runtime, which expects a global React; Vite uses the automatic runtime in the app.
(globalThis as { React?: unknown }).React = ReactRuntime;
const routed = (node: ReactElement) => renderToStaticMarkup(h(MemoryRouter, null, node));
/** The public site: no preview context. */
const publicHtml = (node: ReactElement) => routed(node);
/** Inside the editor: the same view rendered through PreviewKit's EditorWithPreview. */
const previewHtml = (node: ReactElement) => routed(h(EditorWithPreview, { editor: null, preview: node }));
const spots = (html: string) => [...html.matchAll(/data-edit-spot="([^"]+)"/g)].map(m => m[1]!);
const noEditUi = (html: string, label: string) => {
  assert.equal(spots(html).length, 0, `${label}: no Edit buttons on the public site`);
  assert.doesNotMatch(html, /group\/edit|Edit headline|Edit paragraph|Edit question/, `${label}: no EditSpot wrapper`);
};
const draftHome = { ...DEFAULT_HOME, hero: { ...DEFAULT_HOME.hero, headline: 'Draft headline zz1', shortcuts: [{ detail: 'Draft detail', label: 'Draft shortcut zz2', link: '/courses' }] },
  journey: { ...DEFAULT_HOME.journey, steps: [{ title: 'Draft step zz3', text: 'Step text' }] }, faq: { ...DEFAULT_HOME.faq, questions: [{ question: 'Draft question zz4?', answer: 'A' }] } };

test('homepage view renders the draft; Edit buttons appear only inside the preview', () => {
  const props = { home: draftHome, programs: [], loading: false, error: '' };
  const live = publicHtml(h(HomeView, props));
  for (const text of ['Draft headline zz1', 'Draft shortcut zz2', 'Draft step zz3', 'Draft question zz4?', DEFAULT_HOME.catalog.empty_text]) assert.ok(live.includes(text), text);
  noEditUi(live, 'homepage');
  const preview = previewHtml(h(HomeView, props));
  assert.ok(preview.includes('Draft headline zz1'));
  const targets = spots(preview);
  for (const t of ['home-hero', 'home-buttons', 'home-shortcut-0', 'home-catalog', 'home-catalog-empty', 'home-journey', 'home-step-0', 'home-faq', 'home-q-0']) assert.ok(targets.includes(t), t);
  assert.ok(targets.every(t => /^home-(hero|buttons|catalog|catalog-empty|journey|faq|shortcut-\d+|step-\d+|q-\d+)$/.test(t)), 'every spot points at an editor section');
  assert.match(preview, /Edit headline/);
  // Programs come from the real catalog; when there are some, the empty text is not shown.
  const withPrograms = publicHtml(h(HomeView, { ...props, programs: parseHomePrograms([{ id: 1, slug: 'rma', title: 'Program zz5' }, { bad: true }]) }));
  assert.ok(withPrograms.includes('Program zz5'));
  assert.ok(!withPrograms.includes(DEFAULT_HOME.catalog.empty_text));
  assert.deepEqual(parseHomePrograms({ not: 'a list' }), []);
});

test('page views render the draft with Edit buttons per block only inside the preview', () => {
  const faq = { title: 'Draft FAQ zz6', paragraphs: [], steps: [], questions: [{ question: 'Q one zz7', answer: 'Answer one' }, { question: 'Q two', answer: 'Answer two' }] };
  noEditUi(publicHtml(h(FaqView, { page: faq })), 'faq');
  const faqPreview = previewHtml(h(PublicPageView, { pageKey: 'faq', page: faq, site: DEFAULT_SITE }));
  assert.ok(faqPreview.includes('Draft FAQ zz6') && faqPreview.includes('Q one zz7'));
  assert.deepEqual(spots(faqPreview), ['page-title', 'page-q-0', 'page-q-1']);

  const how = { title: 'How draft', paragraphs: ['Closing zz8'], steps: [{ title: 'Step A', text: 'Do it' }], questions: [] };
  const howLive = publicHtml(h(HowItWorksView, { page: how }));
  assert.ok(howLive.includes('1<!-- -->. <!-- -->Step A') || howLive.includes('1. Step A'), howLive);
  assert.ok(howLive.includes('Closing zz8'));
  noEditUi(howLive, 'how-it-works');
  assert.deepEqual(spots(previewHtml(h(PublicPageView, { pageKey: 'how-it-works', page: how, site: DEFAULT_SITE }))), ['page-title', 'page-step-0', 'page-para-0']);

  const policy = { title: 'Terms zz9', paragraphs: ['One', 'Two'], steps: [], questions: [] };
  noEditUi(publicHtml(h(PolicyView, { page: policy })), 'policy');
  assert.deepEqual(spots(previewHtml(h(PublicPageView, { pageKey: 'terms', page: policy, site: DEFAULT_SITE }))), ['page-title', 'page-para-0', 'page-para-1']);

  const about = { title: 'About draft', paragraphs: ['First zz10', 'Second zz11'], steps: [], questions: [] };
  const aboutLive = publicHtml(h(AboutView, { page: about }));
  assert.ok(aboutLive.includes('First zz10') && aboutLive.includes('Second zz11'));
  assert.doesNotMatch(aboutLive, /<details/, 'every paragraph is shown, none is collapsed');
  noEditUi(aboutLive, 'about');
  const aboutPreview = previewHtml(h(PublicPageView, { pageKey: 'about', page: about, site: DEFAULT_SITE }));
  assert.doesNotMatch(aboutPreview, /<details/, 'every paragraph is shown, none is collapsed');
  assert.deepEqual(spots(aboutPreview), ['page-title', 'page-para-0', 'page-para-1']);
  assert.doesNotMatch(publicHtml(h(AboutView, { page: { ...about, paragraphs: ['Only one'] } })), /More about IRIP/, 'no "More" section');
  assert.match(publicHtml(h(AboutView, { page: about, unpublished: true })), /being updated/);

  const contact = { title: 'Contact draft zz12', paragraphs: ['Intro'], steps: [], questions: [] };
  const site = { ...DEFAULT_SITE, contact_email: 'hello@irip.example' };
  const contactLive = publicHtml(h(ContactView, { page: contact, site }));
  assert.ok(contactLive.includes('Contact draft zz12') && contactLive.includes('mailto:hello@irip.example') && contactLive.includes('Send inquiry'));
  noEditUi(contactLive, 'contact');
  assert.deepEqual(spots(previewHtml(h(PublicPageView, { pageKey: 'contact', page: contact, site }))), ['page-title', 'page-para-0'], 'contact details are edited under Site details, not here');
  const contactOff = publicHtml(h(ContactView, { page: contact, site, unpublished: true }));
  assert.ok(contactOff.includes('Send us a question') && !contactOff.includes('Contact draft zz12') && contactOff.includes('Send inquiry'), 'unpublished intro is hidden, form stays');
});

test('footer and contact block preview the site details draft', () => {
  const site = { ...DEFAULT_SITE, site_name: 'IRIP draft zz13', contact_phone: '+880 1700-000000', social_links: [{ label: 'LinkedIn zz14', url: 'https://www.linkedin.com/x' }] };
  const live = publicHtml(h(FooterView, { site }));
  assert.ok(live.includes('IRIP draft zz13') && live.includes('LinkedIn zz14') && live.includes('tel:+8801700000000'));
  noEditUi(live, 'footer');
  assert.doesNotMatch(publicHtml(h(FooterView, { site: DEFAULT_SITE })), /No social media links|No email/, 'preview-only placeholders never reach visitors');
  const preview = previewHtml(h(SitePreview, { site }));
  for (const t of ['site-identity', 'site-contact', 'site-social-0', 'site-notes']) assert.ok(spots(preview).includes(t), t);
  assert.ok(preview.includes('+880 1700-000000'));
  const empty = previewHtml(h(SitePreview, { site: DEFAULT_SITE }));
  assert.ok(empty.includes('No social media links') && spots(empty).includes('site-social'), 'empty lists still have an Edit button in the preview');
});

test('version status says what visitors see now', () => {
  const base = { key: 'faq', is_policy: false, published_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T10:00:00Z' };
  assert.equal(versionStatus({ ...base, status: 'published', has_unpublished_changes: false }, 'home', false).badge, 'Published');
  assert.equal(versionStatus({ ...base, status: 'published', has_unpublished_changes: false }, 'site', true).badge, 'Changes not yet published');
  const upToDate = versionStatus({ ...base, status: 'published', has_unpublished_changes: false }, 'page', false);
  assert.equal(upToDate.tone, 'published'); assert.match(upToDate.preview, /exactly what visitors see/);
  const pending = versionStatus({ ...base, status: 'published', has_unpublished_changes: true }, 'page', false);
  assert.equal(pending.badge, 'Changes not yet published'); assert.match(pending.visitors, /still see the version published/);
  assert.match(versionStatus({ ...base, status: 'published', has_unpublished_changes: false }, 'page', true).preview, /unsaved/);
  assert.match(versionStatus({ ...base, key: 'terms', is_policy: true, status: 'draft', has_unpublished_changes: false, published_at: null }, 'page', false).visitors, /not yet approved/);
  assert.match(versionStatus({ ...base, status: 'draft', has_unpublished_changes: false, published_at: null }, 'page', false).visitors, /isn’t available/);
  assert.equal(versionStatus({ ...base, status: 'draft', has_unpublished_changes: false }, 'page', false).badge, 'Draft — not on the site');
});

test('publish/unpublish rules and the leave-page guard', () => {
  assert.equal(pageActionBlocks({ status: 'published', has_unpublished_changes: false }, false).publish, 'The published version is already up to date.');
  assert.equal(pageActionBlocks({ status: 'published', has_unpublished_changes: true }, false).publish, '');
  assert.equal(pageActionBlocks({ status: 'draft', has_unpublished_changes: false }, false).publish, '');
  assert.match(pageActionBlocks({ status: 'draft', has_unpublished_changes: false }, true).publish, /Save/);
  assert.match(pageActionBlocks({ status: 'published', has_unpublished_changes: false }, true).unpublish, /Save or discard/, 'unpublishing would silently drop unsaved edits');
  const here = { origin: 'http://localhost', pathname: '/admin/website', search: '?tab=home' };
  assert.equal(leavesPage({ href: 'http://localhost/admin/programs', target: '', inPreview: false }, here), true);
  assert.equal(leavesPage({ href: 'http://localhost/admin/website?tab=home#edit-home-hero', target: '', inPreview: false }, here), false, 'same-page anchor');
  assert.equal(leavesPage({ href: 'http://localhost/programs', target: '', inPreview: true }, here), false, 'preview links are inert');
  assert.equal(leavesPage({ href: 'http://localhost/', target: '_blank', inPreview: false }, here), false, 'new tab keeps the draft');
  assert.equal(leavesPage({ href: 'mailto:a@b.c', target: '', inPreview: false }, here), false);
});
