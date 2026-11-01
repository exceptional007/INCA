# Student records, approvals, and attendance

## Register a student

Open **Academic Master → Students → Add Student** as Admin, HOD, or Super Admin.
Enter the actual college ID, roll number, university enrollment number, and institutional email.
Select a department and a program/semester/section. The section links the student to their timetable.
Personal details include name, gender, date of birth, phone, blood group, address, and emergency contacts.
An optional JPG, PNG, or WebP photo (maximum 5 MB) previews before submission.

Admins and Super Admins may select any active department; HODs register students in their assigned department.
The server checks the section belongs to that department and is active. Missing academic configuration is shown clearly.
Initial passwords may be entered or generated securely. The credentials dialog appears only after the server confirms account and profile creation.
New accounts must change their password at first login.

The photo uploads with the registration request. Login and profile records are created in one database transaction.
If persistence fails, the uploaded photo is removed. A storage failure creates no account.
Duplicate identifiers return a conflict instead of another account.

## Profile approvals

Reviewers can open **Profile approvals** from the post-login hub or the academic administration sidebar.
Admins review student/faculty/HOD/coordinator requests campus-wide; HODs review faculty/student requests within their department.
Super Admins retain approval of administrator changes. Nobody can approve their own request.
New requests notify eligible reviewers, and the inbox refreshes every 30 seconds.
Review the proposed changes/photo, then approve or reject. Rejection remarks are optional and visible to the requester.

## Student timetable and reports

Students see only their assigned section’s current weekly timetable and dated lecture attendance.
Administrative import, generation, and academic configuration controls are not rendered in their scheduling view.
Unassigned students see instructions to contact an Admin rather than another section’s timetable.
Historical attendance records remain available after a section transfer.

**Reports & Analytics → My attendance** filters the signed-in student's submitted records by subject, single date, date range, or all time.
Totals cover all matching records; the list is paginated. Present, Late, and Excused count as attended.
No records means no attendance percentage, rather than an invented zero percent.

## Attendance objections

From a submitted lecture, choose **Raise an objection**, supply a reason, and optionally request a corrected status.
Only past/present, non-cancelled lecture sessions from the student’s timetable or own historical records are eligible.
Only one pending objection is allowed for each student/session. Activity attendance does not support this lecture-specific workflow.

Admins use **Attendance objections** for campus-wide review; HODs see only their department.
Approve/reject decisions support optional remarks and notify the student.
An approved requested correction updates or creates the student's attendance record and writes an attendance audit entry in the same serializable transaction.
Review-only approvals do not change attendance. Concurrent decisions and stale status changes return conflicts.
For stale requests, reject with an explanation so the student can submit a fresh request if still needed.

## API endpoints

All paths below use `/api/v1` and JWT authentication.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/students/registration-options` | Admin, HOD, Super Admin; department scoped |
| POST | `/students/accounts` | Same; JSON or multipart `photo` plus validated registration fields |
| GET | `/profile/review-queue` | Eligible profile reviewers |
| POST | `/profile/requests/:id/approve` | Authorized reviewer |
| POST | `/profile/requests/:id/reject` | Authorized reviewer; optional `reason` |
| GET | `/student-portal/context` | Current student only |
| GET | `/student-portal/timetable?date=YYYY-MM-DD` | Current student only; defaults to campus date |
| GET | `/student-portal/attendance` | Current student only; `date` or `startDate`/`endDate`, `subjectId`, `page`, `limit` (maximum 100) |
| GET/POST | `/student-portal/objections` | Own history/create; `sessionId`, required `reason`, optional `requestedStatus` |
| GET | `/attendance/objections` | Admin campus-wide / HOD department; latest 100, pending first |
| POST | `/attendance/objections/:id/review` | Authorized reviewer; `decision` APPROVED/REJECTED, optional `remark` |

## Verification

235 focused backend checks cover registration, multipart photo handling/retrieval, rollback, duplicate identifiers,
profile scope/notifications, authorization, input validation, student privacy, filters, and objection decisions.
HTTP integration tests use the actual controllers/services with isolated in-memory persistence and mocked object storage.
Browser checks use the actual React views against local synthetic API fixtures; no real student records or review decisions are used as test data.
Mobile checks cover the registration form/photo preview, lecture objection dialog, reviewer decision dialog, and student views.
Production storage writes are not exercised by these automated checks.

The additive migration is `20261101170000_student_attendance_objections`.
