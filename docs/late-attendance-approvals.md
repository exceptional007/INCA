# Late attendance approval

## Policy

- Faculty can save an open lecture roster from 10 minutes before its start until **15 minutes after its end**, using the Asia/Kolkata campus clock.
- After that grace period, the currently assigned faculty must obtain permission from an Admin or HOD in the lecture section's department.
- Admin/HOD/Coordinator retain their existing scoped operational marking access. SUPER_ADMIN remains read-only for attendance.
- Each approval applies to one faculty account and one unchanged lecture, expires 24 hours after approval, and is consumed on successful lecture submission.
- Submitted sessions remain locked. Existing audited record corrections and their 24-hour edit window are preserved; a late approval does not reopen them.

## Faculty

Use **Request Admin Approval** on a past unsubmitted lecture, or open **Campus Operations → Late attendance approvals**.
Choose the lecture and provide a reason. Duplicate pending requests are rejected.
The page shows pending, approved, rejected, expired, stale, cancelled, and used states, plus reviewer remarks and expiry.
Use **Mark approved lecture** after approval; this loads the actual requested lecture even when it is from an earlier date.
Cancel a pending or unused approved request when needed, including a stale request before resubmission.
The dashboard and timetable refresh permission state on focus and every 30 seconds.

## Admin/HOD

Open **Late attendance approvals** from the sidebar or the Admin dashboard's review shortcut.
Only requests for the reviewer's assigned department appear. Review the reason and lecture snapshot, then approve for 24 hours or reject.
Remarks are optional. Self-review, repeated decisions, foreign-department review, and approval of changed/locked lectures are blocked.
Faculty receive an in-app decision notification. The request's audit history records requester, reviewer, cancellation, and consumption events.

## Enforcement and offline submissions

Server checks run on ordinary record saves, session submission, and atomic offline upload, including direct API calls.
Approval checks and record writes/permission consumption run inside serializable database transactions.
Final submission requires a complete current lecture roster; a failed or incomplete submission does not consume permission.
Exact retries of an already uploaded offline submission remain idempotent.
Session dates derive from the actual lecture rather than a client-supplied date.

An offline upload that reaches the server after the grace period requires late permission. Local marks remain saved on the device.
Request approval, then choose **Recheck cloud** in the offline status panel to retry those retained marks.
An expired approval, changed lecture, or changed faculty assignment requires a fresh request.

## API

All paths use `/api/v1` and authenticated JWT sessions.

| Method | Path | Access / body |
| --- | --- | --- |
| POST | `/attendance/late-requests` | FACULTY; `scheduleId`, `reason` |
| GET | `/attendance/late-requests/mine` | Own faculty history and valid `approvedScheduleIds` |
| GET | `/attendance/late-requests/queue` | Department ADMIN/HOD queue and audit history |
| POST | `/attendance/late-requests/:id/review` | Department ADMIN/HOD; `decision` APPROVED/REJECTED, optional `remark` |
| POST | `/attendance/late-requests/:id/cancel` | Owning FACULTY; unused pending/approved requests |

The legacy generic `/requests` rows are retained, but their free-text schedule IDs do not grant attendance permission.
Existing legacy approvals must be replaced with a new validated request if permission is still needed.

## Database and verification

The additive migration `20261103110000_late_attendance_approvals` adds typed requests, foreign keys, a partial unique pending-request index, and append-only event history. It does not change submitted attendance marks.
Automated tests cover request ownership, department scope, role restrictions, DTO tampering, duplicates, optional rejection remarks, grace boundaries, expiry, cancellation, stale timetables, complete rosters, transaction rollback, direct API bypass attempts, and offline retries.
Browser checks use local synthetic data for Faculty submission/history, Admin approval, HOD rejection without remarks, and mobile dialogs.
