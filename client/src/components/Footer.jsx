import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { READ_ONLY_PREVIEW } from '../lib/readOnlyPreview';
import { IripMark } from './shared/IripMark';
import { DemoDisclosure } from './shared/DemoNotice';
import { ReadOnlyPreviewNotice } from './shared/ReadOnlyPreview';

export function Footer() {
  return (
    <footer className="border-t border-brand-800 bg-brand-900 text-white/75 mt-auto">
      <div className="container-page py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <IripMark className="h-9 w-9 shrink-0" />
              <span className="text-sm font-semibold text-white">IRIP</span>
            </div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-300">Institute of Research, Innovation and Practice</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Structured theory courses with supervised practical research projects for learners in Bangladesh.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
               <li><Link to="/programs" className="hover:text-white">Programs</Link></li>
               <li><Link to="/courses" className="hover:text-white">Courses</Link></li>
               <li><Link to="/student-value" className="hover:text-white">Student value proposals</Link></li>
              <li><Link to="/projects" className="hover:text-white">Projects</Link></li>
              <li><Link to="/mentors" className="hover:text-white">Mentors</Link></li>
              <li><Link to={READ_ONLY_PREVIEW ? '/teach' : '/teach/apply'} className="font-semibold text-brand-100 hover:text-white">{READ_ONLY_PREVIEW ? 'Mentor application info' : 'Apply as a mentor'}</Link></li>
              <li><Link to="/about" className="hover:text-white">About</Link></li>
              <li><Link to="/demo-guide" className="hover:text-white">Validate the demo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Learner</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/app" className="hover:text-white">Student Portal</Link></li>
              <li><Link to="/certificates" className="hover:text-white">Certificates</Link></li>
              <li><Link to="/app/support" className="hover:text-white">Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Policy</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/policies/terms" className="hover:text-white">Terms</Link></li>
              <li><Link to="/policies/privacy" className="hover:text-white">Privacy</Link></li>
              <li><Link to="/policies/refund" className="hover:text-white">Refund</Link></li>
              <li><Link to="/policies/integrity" className="hover:text-white">Integrity</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contact" className="hover:text-white">Send an inquiry</Link></li>
              <li><Link to="/certificates" className="flex items-center gap-2 hover:text-white"><ShieldCheck className="h-4 w-4" /> Verify a certificate</Link></li>
            </ul>
          </div>
        </div>
        <div className="mb-6 max-w-4xl space-y-2 text-brand-100"><DemoDisclosure />{READ_ONLY_PREVIEW && <ReadOnlyPreviewNotice />}</div>
        <div className="border-t border-white/15 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/75">
          <span>IRIP — Institute of Research, Innovation and Practice. Local prototype guided by the 28-sheet workbook.</span>
          <span>P0 launch essentials · No unverified commercial claims.</span>
        </div>
      </div>
    </footer>
  );
}
