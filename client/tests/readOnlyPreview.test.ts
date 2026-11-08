import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsPreviewRoute } from '../src/lib/readOnlyPreview';
test('read-only preview allowlist excludes all private, account and submission routes', () => {
  for (const route of ['/', '/preview-info', '/programs', '/programs/research-methods-acceleration', '/programs/research-bootcamp', '/courses/recorded/causal', '/mentors/5', '/internships', '/policies/privacy', '/enrol/research-methods-acceleration/2027-01', '/enrol/research-bootcamp/2027-01']) assert.equal(allowsPreviewRoute(route), true, route);
  for (const route of ['/login', '/signup', '/app', '/app/portfolio', '/mentor/courses', '/admin', '/contact', '/ideas/mine', '/ideas/%6dine', '/teach/apply', '/checkout/1', '/internships/test/apply', '/internships/test%2fapply', '/events/test/register', '/certificates', '/programs-malicious', '/ideas/%', '/enrol/research-methods-acceleration/2027-13', '/enrol/research-bootcamp/2027-13', '/enrol/research-methods-acceleration/2027-01/pay', '/enrol/other/2027-01']) assert.equal(allowsPreviewRoute(route), false, route);
});
