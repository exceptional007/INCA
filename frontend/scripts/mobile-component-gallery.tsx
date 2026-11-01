// Loaded exclusively by mobile-preview-server.mjs, never by the production app.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import '../src/index.css';
import { listing, report, claim, poll, note, notice, overview, reportDetail } from './layout-fixtures.mjs';

const cases = {
  'listing-detail': ['../src/pages/marketplace/ListingDetailModal.tsx', 'ListingDetailModal'],
  'chat': ['../src/pages/marketplace/ChatDealModal.tsx', 'ChatDealModal'],
  'listing-report': ['../src/pages/marketplace/ReportModal.tsx', 'ReportModal'],
  'review': ['../src/pages/marketplace/ReviewModal.tsx', 'ReviewModal'],
  'lost-detail': ['../src/pages/lost-found/ItemDetailModal.tsx', 'ItemDetailModal'],
  'claim': ['../src/pages/lost-found/ClaimModal.tsx', 'ClaimModal'],
  'handover': ['../src/pages/lost-found/HandoverVerifyModal.tsx', 'HandoverVerifyModal'],
  'matches': ['../src/pages/lost-found/AiMatchesModal.tsx', 'AiMatchesModal'],
  'vote': ['../src/pages/polls/components/VoteModal.tsx', 'VoteModal'],
  'results': ['../src/pages/polls/components/PollResultsModal.tsx', 'PollResultsModal'],
  'voters': ['../src/pages/polls/components/VoterReportModal.tsx', 'VoterReportModal'],
  'upload-note': ['../src/pages/notes/components/UploadNoteModal.tsx', 'UploadNoteModal'],
  'edit-note': ['../src/pages/notes/components/EditNoteModal.tsx', 'EditNoteModal'],
  'replace-note': ['../src/pages/notes/components/ReplaceDocumentModal.tsx', 'ReplaceDocumentModal'],
  'delete-note': ['../src/pages/notes/components/DeleteNoteConfirmDialog.tsx', 'DeleteNoteConfirmDialog'],
  'document': ['../src/pages/notes/components/DocumentPreviewModal.tsx', 'DocumentPreviewModal'],
  'tutor': ['../src/pages/notes/components/AITutorModal.tsx', 'AITutorModal'],
  'quiz': ['../src/pages/notes/components/AIQuizModal.tsx', 'AIQuizModal'],
  'notice-detail': ['../src/pages/notices/NoticeDetailModal.tsx', 'NoticeDetailModal'],
  'notice-analytics': ['../src/pages/notices/NoticeAnalyticsModal.tsx', 'NoticeAnalyticsModal'],
  'notice-review': ['../src/pages/notices/NoticeReviewDialog.tsx', 'NoticeReviewDialog'],
  'lecture': ['../src/components/timetable/AddEditLectureModal.tsx', 'AddEditLectureModal'],
  'upload-timetable': ['../src/components/timetable/TimetableUploadModal.tsx', 'TimetableUploadModal'],
  'reports-overview': ['../src/pages/reports/ReportsOverviewView.tsx', 'ReportsOverviewView'],
  'report-student': ['../src/pages/reports/StudentReportView.tsx', 'StudentReportView'],
  'report-section': ['../src/pages/reports/SectionReportView.tsx', 'SectionReportView'],
  'report-subject': ['../src/pages/reports/SubjectReportView.tsx', 'SubjectReportView'],
  'report-faculty': ['../src/pages/reports/FacultyReportView.tsx', 'FacultyReportView'],
  'attendance-swipe': ['../src/components/attendance/CardSwipeAttendance.tsx', 'CardSwipeAttendance'],
  'import-review': ['../src/pages/academic/import/components/TimetableReviewGrid.tsx', 'TimetableReviewGrid'],
  'import-history': ['../src/pages/academic/import/components/TimetableVersionHistory.tsx', 'TimetableVersionHistory'],
};
const name = new URLSearchParams(location.search).get('case') || 'listing-detail';
const selected = cases[name];
if (!selected) throw Error('Unknown local gallery case');
const module = await import(/* @vite-ignore */ selected[0]);
const Component = module[selected[1]];
const noop = () => {};
const props = { isOpen: true, onClose: noop, onSuccess: noop, onCreated: noop, onSave: async () => {}, onConfirm: async () => {}, currentUserId: 'layout-demo', userRole: 'ADMIN', listing, conversationId: 'demo-conversation', transactionId: 'demo-transaction', targetId: listing.id, targetType: 'listing', report, item: report, claim, matches: [{ id: 'demo-match', matchingScore: 92, matchReason: 'Similar bag found near the study area.', status: 'PENDING_REVIEW', lostReport: { ...report, type: 'LOST' }, foundReport: report }], poll, note, notice, noticeId: notice.id, defaultDay: 'MONDAY', onOpenChat: noop, onInitiateBuy: noop, onReport: noop, onReviewed: noop, onOpenClaim: noop, onOpenMatches: noop, onVerifyHandover: noop, onClaimSuccess: noop, onMatchUpdated: noop, onVoted: noop, onOpenVoterReport: noop, onDownload: noop, data: overview, onDrillDownStudent: noop, onDrillDownDepartment: noop };
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
Object.assign(props, { data: name === 'reports-overview' ? overview : reportDetail, onBack: noop, onDrillDownSubject: noop, onDrillDownSection: noop, studentList: [{ id: 'demo-student', firstName: 'Aarav', lastName: 'Sharma', rollNumber: 'CSE-2026-001', collegeId: 'CSE-2026-001' }], attendanceMap: {}, onMarkStatus: noop, onSubmit: noop });
Object.assign(props, { defaultDay: 'Monday', action: 'reject', onReviewed: noop, slots: [], sections: [], conflicts: [], onUpdateSlot: async () => {}, onAddSlot: async () => {}, onDeleteSlot: async () => {} });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AuthProvider><BrowserRouter><main className="p-3 min-w-0"><Component {...props} /></main></BrowserRouter></AuthProvider></QueryClientProvider>);
