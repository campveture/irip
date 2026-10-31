import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstallmentPlan, formatInstallmentAmount, INSTALLMENT_MILESTONES } from '../src/components/pricing/installmentModel';

test('program fees use round thousands with the remaining balance in the final installment', () => {
  assert.deepEqual(createInstallmentPlan(24000)?.amounts, [8000, 8000, 8000]);
  assert.equal(createInstallmentPlan(24000)?.hasRoundingAdjustment, false);
  assert.deepEqual(createInstallmentPlan(25000)?.amounts, [8000, 8000, 9000]);
  assert.deepEqual(createInstallmentPlan(12000)?.amounts, [4000, 4000, 4000]);
  assert.deepEqual(createInstallmentPlan(15000)?.amounts, [5000, 5000, 5000]);
  assert.deepEqual(createInstallmentPlan(20000)?.amounts, [6000, 6000, 8000]);
  assert.equal(createInstallmentPlan(25000)?.hasRoundingAdjustment, true);
  assert.deepEqual(createInstallmentPlan(1)?.amounts, [0, 0, 1]);
  assert.deepEqual(createInstallmentPlan(0)?.amounts, [0, 0, 0]);
  for (let total = 0; total < 100000; total += 37) {
    const plan = createInstallmentPlan(total)!;
    assert.equal(plan.amounts.reduce((sum, amount) => sum + amount, 0), total);
    assert.ok(plan.amounts.every(Number.isInteger));
  }
});

test('invalid prices never become a misleading zero-fee schedule', () => {
  for (const fee of [null, undefined, '25000', -1, NaN, Infinity, 0.001, 25000.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(createInstallmentPlan(fee), null);
  }
  assert.equal(createInstallmentPlan(25000, 'invalid'), null);
  assert.equal(createInstallmentPlan(25000, null), null);
});

test('milestones distinguish enrollment from class start and the following calendar month', () => {
  assert.deepEqual(INSTALLMENT_MILESTONES, ['At enrollment', 'When classes start', 'One calendar month after classes start']);
  assert.equal(formatInstallmentAmount(8000, 'BDT').replace(/\s/g, ' '), 'BDT 8,000');
});
