import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsPreviewRoute } from '../src/lib/readOnlyPreview';
test('read-only preview allowlist excludes all private, account and submission routes', () => {
  for (const route of ['/', '/preview-info', '/programs', '/programs/research-bootcamp', '/courses/recorded/causal', '/mentors/5', '/internships', '/policies/privacy']) assert.equal(allowsPreviewRoute(route), true, route);
  for (const route of ['/login', '/signup', '/app', '/app/portfolio', '/mentor/courses', '/admin', '/contact', '/ideas/mine', '/ideas/%6dine', '/teach/apply', '/checkout/1', '/internships/test/apply', '/internships/test%2fapply', '/events/test/register', '/certificates', '/programs-malicious', '/ideas/%']) assert.equal(allowsPreviewRoute(route), false, route);
});
