import { useWorkspaceData, WorkspaceFrame } from './useWorkspaceData';

export default function AdminAcademics() {
  const { data, error, loading } = useWorkspaceData('/admin/academics');
  return <WorkspaceFrame title="Academics" description="Courses, module sequence and assessment coverage from the shared catalog." loading={loading} error={error}>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Courses</h2>
        {data?.courses.length ? <ul className="mt-4 divide-y divide-slate-100">{data.courses.map((course) => <li key={course.id} className="py-3">
          <div className="flex justify-between gap-3"><strong>{course.title}</strong><span className="text-xs text-slate-500">{course.status}</span></div>
          <p className="mt-1 text-sm text-slate-600">{course.program_title || 'Standalone'} · {course.module_count} modules · {course.assessment_count} assessments</p>
        </li>)}</ul> : <p className="mt-4 text-sm text-slate-600">No courses recorded.</p>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Modules</h2>
        {data?.modules.length ? <ul className="mt-4 divide-y divide-slate-100">{data.modules.map((module) => <li key={module.id} className="py-3">
          <strong>{module.title}</strong><p className="mt-1 text-sm text-slate-600">{module.course_title} · Week {module.week ?? 'TBD'} · {module.lesson_count} lessons</p>
        </li>)}</ul> : <p className="mt-4 text-sm text-slate-600">No modules recorded.</p>}
      </section>
    </div>
    <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{data?.publication_note}</p>
  </WorkspaceFrame>;
}
