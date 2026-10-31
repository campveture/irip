import test from 'node:test';
import assert from 'node:assert/strict';
import { falseAlarmProbability, simpsonGroups, combinedRates } from '../src/components/shared/researchPuzzles';
test('multiple-testing hero uses the independent true-null family-wise probability, not a posterior claim', () => {
  assert.ok(Math.abs(falseAlarmProbability(1) - 0.05) < 1e-12);
  assert.equal((falseAlarmProbability(20)*100).toFixed(1), '64.2');
  assert.equal((falseAlarmProbability(100)*100).toFixed(1), '99.4');
  assert.equal(falseAlarmProbability(10,0), 0); assert.equal(falseAlarmProbability(10,1), 1);
  for (const value of [0,-1,1.5,Infinity]) assert.throws(() => falseAlarmProbability(value));
});
test('invented Simpson example reverses the aggregate despite B leading in both strata', () => {
  for (const group of simpsonGroups) assert.ok(group.b.successes / group.b.total > group.a.successes / group.a.total);
  const rates = combinedRates(); assert.equal(rates.a, 0.82); assert.equal(rates.b, 0.35); assert.ok(rates.a > rates.b);
});
