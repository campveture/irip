const { weekendPlan } = require('./program-planning');
const DAY = 86400000;
const dateString = time => new Date(time).toISOString().slice(0, 10);
const monthName = time => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(time));

function firstFriday(year, month) {
  const middle = Date.UTC(year, month, 15);
  return middle + ((5 - new Date(middle).getUTCDay() + 7) % 7) * DAY;
}

function nextCalendarMonth(day) {
  const current = new Date(`${day}T00:00:00Z`);
  const year = current.getUTCFullYear(), month = current.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return dateString(Date.UTC(year, month + 1, Math.min(current.getUTCDate(), last)));
}

// Pure public planning model. No enrollments, holds, orders or payments are written.
function launchIntakes(program, reference = new Date()) {
  if (program.slug !== 'research-bootcamp') return null;
  const now = new Date(reference);
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid launch planning date');
  const local = new Date(now.getTime() + 6 * 3600000);
  let monthIndex = Math.max(2027 * 12, local.getUTCFullYear() * 12 + local.getUTCMonth());
  const intakes = [];
  while (intakes.length < 2) {
    const year = Math.floor(monthIndex / 12), month = monthIndex % 12;
    monthIndex += 1;
    const first = firstFriday(year, month);
    // Five calendar days before class, at 23:59 Bangladesh time (17:59 UTC).
    const deadline = first - 5 * DAY + (17 * 60 + 59) * 60000;
    if (deadline <= now.getTime()) continue;
    const key = dateString(Date.UTC(year, month, 1)).slice(0, 7);
    const cohort = { id: `research-bootcamp-${key}`, program_id: program.id, name: `${monthName(first)} Bootcamp`,
      capacity: program.capacity, start_date: dateString(first), end_date: dateString(first + 83 * DAY),
      enrollment_deadline: new Date(deadline).toISOString(), status: 'open', allocated: 0 };
    const discount = intakes.length === 0 ? 4000 : 0;
    const amount = 25000 - discount;
    const firstAmount = Math.floor(amount / 3000) * 1000;
    intakes.push({ ...cohort,
      seats: { basis: 'synthetic', as_of: now.toISOString(), active: 0, pending: 0, held: 0, remaining: program.capacity, over_capacity: 0 },
      plan: weekendPlan(cohort, program),
      launch: { key, position: intakes.length, standard_fee: 25000, discount, total_fee: amount, currency: 'BDT',
        payment_mode: 'demo_only', installments: [
          { amount: firstAmount, due_at: null },
          { amount: firstAmount, due_at: `${dateString(first)}T20:30:00+06:00` },
          { amount: amount - 2 * firstAmount, due_at: `${nextCalendarMonth(dateString(first))}T20:30:00+06:00` },
        ] },
    });
  }
  return intakes;
}

function launchProgramDisplay(program) {
  if (program.slug !== 'research-bootcamp') return program;
  const upcoming = launchIntakes(program)[0];
  return { ...program, fee: 21000, standard_fee: 25000, launch_discount: 4000,
    start_date: upcoming.start_date, end_date: upcoming.end_date, enrolled_count: 0 };
}

module.exports = { launchIntakes, launchProgramDisplay, firstFriday, nextCalendarMonth };
