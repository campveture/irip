import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import TeachApplication from './pages/public/TeachApplication';
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
import Profile from './pages/account/Profile';
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
import Onboarding from './pages/student/Onboarding';
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
import MentorApplication from './pages/mentor/MentorApplication';
import MentorClasses from './pages/mentor/MentorClasses';
import ClassDetail from './pages/mentor/ClassDetail';
import MentorGrading from './pages/mentor/MentorGrading';
import GradeSubmission from './pages/mentor/GradeSubmission';
import MentorProjects from './pages/mentor/MentorProjects';
import MentorProjectDetail from './pages/mentor/MentorProjectDetail';
import MentorAvailability from './pages/mentor/MentorAvailability';
import MentorTopics from './pages/mentor/MentorTopics';
import MentorEarnings from './pages/mentor/MentorEarnings';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminModules from './pages/admin/AdminModules';
import AdminLearners from './pages/admin/AdminLearners';
import AdminLearnerDetail from './pages/admin/AdminLearnerDetail';
import AdminCatalog from './pages/admin/AdminCatalog';
import AdminCohorts from './pages/admin/AdminCohorts';
import AdminAdmissions from './pages/admin/AdminAdmissions';
import AdminCRM from './pages/admin/AdminCRM';
import AdminSupport from './pages/admin/AdminSupport';
import AdminFinance from './pages/admin/AdminFinance';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAcademics from './pages/admin/AdminAcademics';
import AdminMentors from './pages/admin/AdminMentors';
import AdminProjects from './pages/admin/AdminProjects';
import AdminAutomations from './pages/admin/AdminAutomations';

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
      <Route path="/enrol/:slug/:intake" element={<DemoCheckout />} />
      <Route path="/enroll/offers/:id" element={<AdmissionOfferResponse />} />
      <Route path="/checkout/:orderId" element={<Checkout />} />
      <Route path="/orders/:id/status" element={<OrderStatus />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/recover" element={<Recover />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<Profile />} />
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
        <Route path="onboarding" element={<Onboarding />} />
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
        <Route path="topics" element={<MentorTopics />} />
        <Route path="earnings" element={<MentorEarnings />} />
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
        <Route index element={<AdminDashboard />} />
        <Route path="modules" element={<AdminModules />} />
        <Route path="learners" element={<AdminLearners />} />
        <Route path="learners/:id" element={<AdminLearnerDetail />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="academics" element={<AdminAcademics />} />
        <Route path="learner-success" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><GrowthOperations /></ProtectedRoute>} />
        <Route path="mentors" element={<AdminMentors />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="automations" element={<AdminAutomations />} />
        <Route path="content" element={<ProtectedRoute roles={['academic_ops', 'admin', 'owner']}><ExpansionCuration /></ProtectedRoute>} />
        <Route path="cohorts" element={<AdminCohorts />} />
        <Route path="admissions" element={<AdminAdmissions />} />
        <Route path="crm" element={<AdminCRM />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="certificates" element={<AdminCertificates />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
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
