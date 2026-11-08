import { cardClass } from '../../learner/LearnerShared';
import { LearnerCalendarDays } from '../../learner/LearnerRecords';
import { calendarDays, type CalendarData } from '../../learner/learnerModel';
import { EditSpot } from '../preview/PreviewKit';

/**
 * The learner calendar exactly as enrolled learners see it (same LearnerCalendarDays
 * component as /app/calendar), fed with the draft class schedule. Shows every class,
 * past and upcoming, so staff can check the whole schedule.
 */
export function LearnerCalendarPreview({ data }: { data: CalendarData }) {
  const days = calendarDays(data, new Date(0), false);
  return <div className="space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-semibold text-brand-950">Calendar</h1>
      <p className="mt-1 text-sm text-slate-600">Your classes and assignment due dates. All times are Bangladesh time (GMT+6).</p></div>
    <EditSpot target="schedule" label="class schedule">
      {days.length ? <LearnerCalendarDays days={days} past={false} />
        : <p className={`${cardClass} text-sm text-slate-600`}>Nothing is scheduled. Classes appear here once your cohort’s timetable is published, and assignment due dates once they are set.</p>}
    </EditSpot>
  </div>;
}
