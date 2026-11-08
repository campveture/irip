/**
 * The public course page (/courses/:slug) as a pure view fed by props. The page
 * (pages/public/CourseDetail.jsx) fetches published data; the admin course editor renders
 * it with the unsaved draft as its live preview. EditSpots only show inside that preview.
 */
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, FileText, Layers, Play } from 'lucide-react';
import * as CardJs from '../Card';
import { Button as ButtonJs } from '../Button';
import { Badge as BadgeJs } from '../Badge';
import { EmptyState as EmptyStateJs } from '../EmptyState';
import { PageHeader as PageHeaderJs } from '../PageHeader';
import { SectionHeader as SectionHeaderJs } from '../SectionHeader';
import { programImage } from '../../lib/demoImages';
import { CourseLearningPlan } from '../programs/ProgramCurriculum';
import { EditSpot, useInPreview } from '../admin/preview/PreviewKit';
import { coursePartTarget, coursePlanPrefix, lessonTarget, moduleTarget } from '../programs/editTargets';

// The shared design-system components are plain JavaScript; give them permissive prop types here.
type Loose = ComponentType<{ [key: string]: unknown }>;
const Card = CardJs.Card as unknown as Loose, CardContent = CardJs.CardContent as unknown as Loose, CardHeader = CardJs.CardHeader as unknown as Loose, CardTitle = CardJs.CardTitle as unknown as Loose;
const Button = ButtonJs as unknown as Loose, Badge = BadgeJs as unknown as Loose, EmptyState = EmptyStateJs as unknown as Loose;
const PageHeader = PageHeaderJs as unknown as Loose, SectionHeader = SectionHeaderJs as unknown as Loose;

export interface CoursePageLesson { readonly id: number; readonly title: string; readonly kind: string | null; readonly duration_min: number | null }
export interface CoursePageModule { readonly id: number; readonly title: string; readonly week: number | null; readonly lessons: readonly CoursePageLesson[] }
/** Same shape as GET /api/public/courses/:slug. */
export interface CoursePageData {
  readonly course: { readonly id: number; readonly slug: string; readonly title: string; readonly summary: string | null };
  readonly program: { readonly slug: string; readonly title: string; readonly domain?: string | null | undefined } | null;
  readonly modules: readonly CoursePageModule[];
  readonly syllabus: unknown;
}

function LessonIcon({ kind }: { kind: string | null }) {
  if (kind === 'video') return <Play size={16} />;
  if (kind === 'reading') return <FileText size={16} />;
  return <BookOpen size={16} />;
}
const kindColor = (kind: string | null) => kind === 'video' ? 'bg-brand-50 text-brand-600' : kind === 'reading' ? 'bg-success-50 text-success-600' : 'bg-slate-100 text-slate-600';

export function CourseDetailView({ data }: { data: CoursePageData }) {
  const { course, program, modules } = data;
  const inPreview = useInPreview();
  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
  const totalMinutes = modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + (l.duration_min || 0), 0), 0);

  return (
    <div className="irip-public-detail container-page py-8 animate-fade-in">
      <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> All programs
      </Link>

      <EditSpot target={coursePartTarget(course.id, 'title')} label="course name"><PageHeader title={course.title} subtitle={course.summary} icon={BookOpen} /></EditSpot>
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-brand-50"><img src={programImage({ ...program, ...course })} alt="" width="1000" height="620" className="mx-auto aspect-[50/31] w-full max-w-3xl object-contain" /></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {program && (
              <div className="flex items-center gap-2 mb-4">
                <Link to={`/programs/${program.slug}`} className="text-sm text-brand-600 hover:underline font-medium">{program.title}</Link>
                <span className="w-px h-3 bg-slate-200 mx-1" />
                <span className="text-xs text-slate-400">Course</span>
              </div>
            )}
            <EditSpot target={coursePartTarget(course.id, 'summary')} label="course summary"><p className="text-slate-600 leading-relaxed">{course.summary}</p></EditSpot>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Demo modules', value: modules.length, icon: Layers },
                { label: 'Lesson samples', value: totalLessons, icon: BookOpen },
                { label: 'Sample minutes', value: totalMinutes || '—', icon: Clock },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <m.icon className="h-5 w-5 text-brand-600 shrink-0" />
                  <div><div className="text-xs text-slate-500">{m.label}</div><div className="text-sm font-semibold text-slate-900">{m.value}</div></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Enrollment</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-600">Enrollment and payment are disabled in this demo. Ask about this program to learn more.</p>
            <Link to="/contact" className="block"><Button variant="primary" className="w-full">Ask about this program</Button></Link>
            {program && <Link to={`/programs/${program.slug}`} className="block"><Button variant="outline" className="w-full">View program</Button></Link>}
          </CardContent>
        </Card>
      </div>

      {data.syllabus == null && inPreview
        ? <EditSpot target={coursePartTarget(course.id, 'plan')} label="learning plan"><p className="mb-8 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">No detailed learning plan: this section is hidden from visitors. Turn on “Show a detailed learning plan” to add one.</p></EditSpot>
        : <CourseLearningPlan syllabus={data.syllabus} editPrefix={coursePlanPrefix(course.id)} />}
      <SectionHeader title="Demo modules & lesson samples" subtitle="Existing sample records only, not the complete proposed teaching plan. Playback is not connected." />
      {modules.length === 0 ? (
        <EmptyState icon={BookOpen} title="No modules published yet" description="Modules will appear here once published." />
      ) : (
        <div className="space-y-6">
          {modules.map(m => (
            <EditSpot key={m.id} target={moduleTarget(m.id)} label="module">
              <Card className="overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {m.week !== null && <span className="text-xs font-semibold text-white bg-brand-600 px-2.5 py-1 rounded-full">Week {m.week}</span>}
                      <h3 className="text-lg font-semibold text-slate-900">{m.title}</h3>
                    </div>
                    <Badge variant="default">{m.lessons.length} lesson{m.lessons.length !== 1 ? 's' : ''}</Badge>
                  </div>
                  {m.lessons.length === 0 ? <p className="text-sm text-slate-500">No lessons published yet.</p> : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {m.lessons.map(l => (
                        <EditSpot key={l.id} target={lessonTarget(l.id)} label="lesson">
                          <div className="group rounded-lg border border-slate-200 bg-white p-3 hover:border-brand-300 hover:shadow-soft transition-all">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kindColor(l.kind)}`}><LessonIcon kind={l.kind} /></div>
                              <span className="text-sm text-slate-700 line-clamp-2 font-medium">{l.title}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="capitalize">{l.kind}</span>
                              {l.duration_min ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {l.duration_min}m</span> : null}
                            </div>
                          </div>
                        </EditSpot>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </EditSpot>
          ))}
        </div>
      )}
    </div>
  );
}
