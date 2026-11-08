import { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { READ_ONLY_PREVIEW, allowsPreviewRoute } from './lib/readOnlyPreview';
import { ReadOnlyPreviewPage } from './components/shared/ReadOnlyPreview';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PortalLayout, ProtectedRoute } from './components';
import { AppShell } from './components/shared/AppShell';
import { Spinner } from './components/Spinner';

// Public pages
import Home from './pages/public/Home';
import DemoGuide from './pages/public/DemoGuide';
import Programs from './pages/public/Programs';
import ProgramDetail from './pages/public/ProgramDetail';
import CourseDetail from './pages/public/CourseDetail';
import RecordedCatalog from './components/courses/RecordedCatalog';
import RecordedCourseDetail from './components/courses/RecordedCourseDetail';
import InstructorStudio from './components/courses/InstructorStudio';
import StudentValueRoadmap from './components/opportunities/StudentValueRoadmap';
import GrowthHub from './components/growth/GrowthHub';
import MentorFeedback from './components/growth/MentorFeedback';
import GrowthOperations from './components/growth/GrowthOperations';
import Mentors from './pages/public/Mentors';
import MentorDetail from './pages/public/MentorDetail';
import Teach from './pages/public/Teach';
import TeachApplication from './components/accounts/TeachApplication';
import About from './pages/public/About';
import HowItWorks from './pages/public/HowItWorks';
import FAQ from './pages/public/FAQ';
import Contact from './pages/public/Contact';
import Policy from './pages/public/Policy';
import CertificateVerify from './pages/public/CertificateVerify';
import CertificateLookup from './pages/public/CertificateLookup';
import Projects from './pages/public/Projects';
import PublicProjectDetail from './pages/public/PublicProjectDetail';

// Auth pages
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Recover from './pages/auth/Recover';
import AccountLayout from './pages/account/AccountLayout';
import Profile from './components/accounts/AccountProfile';
import Security from './pages/account/Security';
import NotificationPreferences from './pages/account/NotificationPreferences';
import Verify from './pages/account/Verify';
import { EnrollmentOffer, AdmissionOfferResponse, Checkout, OrderStatus } from './pages/enrollment/EnrollmentScreens';
import { ExpansionList, ExpansionDetail, PartnerPage } from './pages/expansion/ExpansionPages';
import ExpansionCuration from './pages/expansion/ExpansionCuration';
import { EventRegistration, IdeaWorkspace, InternshipApplication } from './pages/expansion/ExpansionActions';
import StudentSubscription from './pages/student/StudentSubscription';
import DemoCheckout from './components/pricing/DemoCheckout';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import ScholarshipPlanner from './components/scholarships/ScholarshipPlanner';
import StudentLearning from './pages/student/StudentLearning';
import EnrollmentDetail from './pages/student/EnrollmentDetail';
import LessonPlayer from './pages/student/LessonPlayer';
import StudentAssignments from './pages/student/StudentAssignments';
import AssignmentDetail from './pages/student/AssignmentDetail';
import StudentCalendar from './pages/student/StudentCalendar';
import StudentProjects from './pages/student/StudentProjects';
import ProjectDetail from './pages/student/ProjectDetail';
import StudentPlan from './pages/student/StudentPlan';
import StudentBilling from './pages/student/StudentBilling';
import StudentCertificates from './pages/student/StudentCertificates';
import StudentSupport from './pages/student/StudentSupport';
import SupportTicket from './pages/student/SupportTicket';
import Notifications from './pages/student/Notifications';

// Mentor pages
import MentorDashboard from './pages/mentor/MentorDashboard';
import MentorApplication from './components/accounts/MentorApplication';
import MentorClasses from './pages/mentor/MentorClasses';
import ClassDetail from './pages/mentor/ClassDetail';
import MentorGrading from './pages/mentor/MentorGrading';
import GradeSubmission from './pages/mentor/GradeSubmission';
import MentorProjects from './pages/mentor/MentorProjects';
import MentorProjectDetail from './pages/mentor/MentorProjectDetail';
import MentorAvailability from './pages/mentor/MentorAvailability';

// Admin pages
import AdminLearners from './pages/admin/AdminLearners';
import AdminLearnerDetail from './pages/admin/AdminLearnerDetail';
import { CohortList, CohortDetailPage } from './components/admin/CohortTeaching';
import StaffAccess from './components/admin/StaffAccess';
import AuditLog from './components/admin/AuditLog';
import WebsiteContent from './components/admin/website/WebsiteContent';
import ProgramList from './components/admin/programs/ProgramList';
import ProgramEditor from './components/admin/programs/ProgramEditor';
import ProjectList from './components/admin/projects/ProjectList';
import ProjectEditor from './components/admin/projects/ProjectEditor';
import AdminHome from './components/admin/operations/AdminHome';
import SupportDesk from './components/admin/operations/SupportDesk';
import Inquiries from './components/admin/operations/Inquiries';
import CertificatesAdmin from './components/admin/operations/CertificatesAdmin';
import AdminAdmissions from './pages/admin/AdminAdmissions';
import AdminFinance from './pages/admin/AdminFinance';
import AdminReports from './pages/admin/AdminReports';
import { MentorQueue as AdminMentors, MentorReview } from './components/accounts/MentorOperations';
import { MentorIntakeReview } from './components/accounts/MentorIntakeOperations';

function LegacyProgramRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/programs/research-methods-acceleration${search}${hash}`} replace />;
}

function LegacyEnrolRedirect() {
  const { intake } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`/enrol/research-methods-acceleration/${encodeURIComponent(intake ?? '')}${search}${hash}`} replace />;
}

function RouterApp() {
  const { user, roles, loading } = useAuth();
  const { pathname } = useLocation();
  if (READ_ONLY_PREVIEW && !allowsPreviewRoute(pathname)) return <ReadOnlyPreviewPage />;
  if (loading) return <main className="container-page flex min-h-[45vh] items-center justify-center" aria-label="Loading account"><Spinner size="lg" /></main>;

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      {READ_ONLY_PREVIEW && <Route path="/preview-info" element={<ReadOnlyPreviewPage />} />}
      <Route path="/demo-guide" element={<DemoGuide />} />
      <Route path="/student-value" element={<StudentValueRoadmap />} />
      <Route path="/programs" element={<Programs />} />
      <Route path="/programs/research-bootcamp" element={<LegacyProgramRedirect />} />
      <Route path="/programs/:slug" element={<ProgramDetail />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:id" element={<PublicProjectDetail />} />
      <Route path="/courses/:slug" element={<CourseDetail />} />
      <Route path="/courses" element={<RecordedCatalog />} />
      <Route path="/courses/recorded/:slug" element={<RecordedCourseDetail />} />
      <Route path="/mentors" element={<Mentors />} />
      <Route path="/mentors/:slug" element={<MentorDetail />} />
      <Route path="/teach" element={<Teach />} />
      <Route path="/teach/apply" element={<TeachApplication />} />
      <Route path="/about" element={<About />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/policies/:key" element={<Policy />} />
      <Route path="/certificates/:token" element={<CertificateVerify />} />
      <Route path="/certificates" element={<CertificateLookup />} />
      {['resources', 'events', 'stories', 'ideas', 'internships'].map((kind) => <Route key={kind} path={`/${kind}`} element={<ExpansionList kind={kind} />} />)}
      {['resources', 'events', 'stories', 'ideas', 'internships'].map((kind) => <Route key={`${kind}-detail`} path={`/${kind}/:${kind === 'ideas' ? 'id' : 'slug'}`} element={<ExpansionDetail kind={kind} />} />)}
      <Route path="/institutions" element={<PartnerPage kind="institution" />} />
      <Route path="/labs" element={<PartnerPage kind="lab" />} />
      <Route path="/events/:slug/register" element={<EventRegistration />} />
      <Route path="/ideas/mine" element={<IdeaWorkspace />} />
      <Route path="/internships/:slug/apply" element={<InternshipApplication />} />
      <Route path="/enroll/:offerId" element={<EnrollmentOffer />} />
      <Route path="/enrol/research-bootcamp/:intake" element={<LegacyEnrolRedirect />} />
      <Route path="/enrol/:slug/:intake" element={<DemoCheckout />} />
      <Route path="/enroll/offers/:id" element={<AdmissionOfferResponse />} />
      <Route path="/checkout/:orderId" element={<Checkout />} />
      <Route path="/orders/:id/status" element={<OrderStatus />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/mentor" element={<Navigate to="/teach/apply" replace />} />
      <Route path="/recover" element={<Recover />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="mentor-application" element={<MentorApplication />} />
        <Route path="security" element={<Security />} />
        <Route path="notifications" element={<NotificationPreferences />} />
      </Route>

      {/* Student portal */}
      <Route
        path="/app/*"
        element={
          <ProtectedRoute roles={['learner', 'admin', 'owner']}>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="onboarding" element={<Profile />} />
        <Route path="scholarships" element={<ScholarshipPlanner />} />
        <Route path="courses" element={<RecordedCatalog library />} />
        <Route path="opportunities" element={<StudentValueRoadmap portal />} />
        <Route path="growth" element={<GrowthHub key="path" />} />
        <Route path="portfolio" element={<GrowthHub key="portfolio" view="portfolio" />} />
        <Route path="career" element={<GrowthHub key="career" view="career" />} />
        <Route path="alumni" element={<GrowthHub key="alumni" view="alumni" />} />
        <Route path="learning" element={<StudentLearning />} />
        <Route path="learning/:enrollmentId" element={<EnrollmentDetail />} />
        <Route path="lessons/:lessonId" element={<LessonPlayer />} />
        <Route path="assignments" element={<StudentAssignments />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="calendar" element={<StudentCalendar />} />
        <Route path="projects" element={<StudentProjects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="plan" element={<StudentPlan />} />
        <Route path="billing" element={<StudentBilling />} />
        <Route path="subscription" element={<StudentSubscription />} />
        <Route path="certificates" element={<StudentCertificates />} />
        <Route path="support" element={<StudentSupport />} />
        <Route path="support/:id" element={<SupportTicket />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Mentor portal */}
      <Route
        path="/mentor/*"
        element={
          <ProtectedRoute roles={['mentor', 'supervisor', 'admin', 'owner']}>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MentorDashboard />} />
        <Route path="application" element={<MentorApplication />} />
        <Route path="classes" element={<MentorClasses />} />
        <Route path="courses" element={<InstructorStudio />} />
        <Route path="feedback" element={<MentorFeedback />} />
        <Route path="classes/:id" element={<ClassDetail />} />
        <Route path="grading" element={<MentorGrading />} />
        <Route path="grading/:submissionId" element={<GradeSubmission />} />
        <Route path="projects" element={<MentorProjects />} />
        <Route path="projects/:id" element={<MentorProjectDetail />} />
        <Route path="availability" element={<MentorAvailability />} />
        {/* Retired: no payable ledger / no real topic data. */}
        <Route path="topics" element={<Navigate to="/mentor" replace />} />
        <Route path="earnings" element={<Navigate to="/mentor" replace />} />
      </Route>

      {/* Admin panel */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute roles={['academic_ops', 'finance', 'support', 'admin', 'owner']}>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="learners" element={<AdminLearners />} />
        <Route path="learners/:id" element={<AdminLearnerDetail />} />
        <Route path="mentors" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><AdminMentors /></ProtectedRoute>} />
        <Route path="approvals" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><AdminMentors approvals /></ProtectedRoute>} />
        <Route path="mentors/:id" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><MentorReview /></ProtectedRoute>} />
        <Route path="mentor-applications/:id" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><MentorIntakeReview /></ProtectedRoute>} />
        <Route path="staff" element={<ProtectedRoute roles={['admin', 'owner']}><StaffAccess /></ProtectedRoute>} />
        <Route path="programs" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><ProgramList /></ProtectedRoute>} />
        <Route path="programs/:id" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><ProgramEditor /></ProtectedRoute>} />
        <Route path="cohorts" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><CohortList /></ProtectedRoute>} />
        <Route path="cohorts/:id" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><CohortDetailPage /></ProtectedRoute>} />
        <Route path="projects" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><ProjectList /></ProtectedRoute>} />
        <Route path="projects/:id" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><ProjectEditor /></ProtectedRoute>} />
        <Route path="admissions" element={<AdminAdmissions />} />
        <Route path="website" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><WebsiteContent /></ProtectedRoute>} />
        <Route path="content" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><ExpansionCuration /></ProtectedRoute>} />
        <Route path="support" element={<ProtectedRoute roles={['support', 'admin', 'owner']}><SupportDesk /></ProtectedRoute>} />
        <Route path="inquiries" element={<ProtectedRoute roles={['academic_ops', 'support', 'admin', 'owner']}><Inquiries /></ProtectedRoute>} />
        <Route path="certificates" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><CertificatesAdmin /></ProtectedRoute>} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="audit" element={<ProtectedRoute roles={['admin', 'owner']}><AuditLog /></ProtectedRoute>} />
        <Route path="learner-success" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><GrowthOperations /></ProtectedRoute>} />
        {/* Retired admin pages: old links land on their replacement. */}
        <Route path="modules" element={<Navigate to="/admin" replace />} />
        <Route path="catalog" element={<Navigate to="/admin/programs" replace />} />
        <Route path="academics" element={<Navigate to="/admin/programs" replace />} />
        <Route path="crm" element={<Navigate to="/admin/inquiries" replace />} />
        <Route path="settings" element={<Navigate to="/admin/website" replace />} />
        <Route path="automations" element={<Navigate to="/admin/audit" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell><RouterApp /></AppShell>
    </AuthProvider>
  );
}
