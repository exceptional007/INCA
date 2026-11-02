# Local INCA demo walkthrough

This guide replaces the unpublished demo-video link. It describes a real local workflow; it is not a hosted video or a substitute for application setup.

[Project overview](../README.md) · [Frontend setup](../frontend/README.md) · [Backend setup](../backend/README.md) · [Screenshots](screenshots/README.md)

## Public preview: no account required

1. From `frontend/`, install the locked dependencies with `npm ci` if needed, then run `npm run dev`.
2. Open [the landing page](http://localhost:5173/). Explore its navigation and feature explanations. Landing-page showcase panels are promotional UI, not proof of populated live campus data.
3. Open [sign-in](http://localhost:5173/login). Do not enter a real campus password into an untrusted or public demonstration instance.

Only these public screens were used for the committed screenshots. No backend or database was started for the captures.

## Prepare an authenticated demonstration

Use a dedicated development database containing synthetic records. Complete backend setup first; the checked-in migration history does not independently cover every current schema model. Do not reset an existing database or start the backend against production to prepare a demo.

Arrange these profiles using the project's account/master-data workflows:

- An active SUPER_ADMIN for department-admin management, if demonstrating that workflow.
- An active ADMIN with a department assigned in AdminProfile.
- A FACULTY user linked to an actual faculty profile and relevant timetable assignments.
- A STUDENT user with an actual student profile and explicit section enrollment.
- Optional COORDINATOR for campus-wide attendance oversight.

Populate a department → program → semester → section hierarchy, plus subjects, rooms, and a timetable/schedule for the demonstration date. For lecture attendance, ensure the synthetic students are enrolled in that exact section. Use generated account credentials privately; do not place passwords or access tokens in this guide or screenshots.

R2 credentials are required to demonstrate uploads/streaming. Configure Gemini for AI-backed extraction/generation, or clearly explain that a fallback/unavailable state is being demonstrated.

## Suggested demonstration sequence

| Step | Account / route | What to demonstrate |
| --- | --- | --- |
| 1 | Any active account → `/hub` | Active modules: ASSAM, notes/tutor, marketplace, lost/found, notices, polls; Green Credits remains coming soon |
| 2 | Department ADMIN → `/academic` | Academic hierarchy, faculty/student profiles, section enrollment, rooms |
| 3 | ADMIN → `/schedules?tab=import` | Upload a synthetic timetable PDF; review extracted mappings, conflicts, and draft slots before approval |
| 4 | ADMIN → `/schedules` | Active timetable and dated schedules within the assigned department |
| 5 | Assigned FACULTY → `/attendance/mark` | Open a real current lecture, load its enrolled roster, mark attendance, submit, and correct a record with a reason if appropriate |
| 6 | STUDENT → `/dashboard` | Own attendance and enrolled-section schedule; no guessed or fallback section |
| 7 | FACULTY → `/notes`, then STUDENT → `/notes` | Create a synthetic learning note; let processing complete; use the student's own tutor/quiz sessions and history |
| 8 | FACULTY/HOD → `/notices`, then department ADMIN | Save a draft or submit for approval; preview and approve/reject in the Approval Queue. Revise rejected notices and resubmit. After approval, inspect the intended recipient's feed and notification; acknowledge if required. ADMIN/SUPER_ADMIN authors can publish directly |
| 9 | Permitted account → `/polls` | Create/use a poll, vote with a synthetic account, inspect results under the applicable permissions |
| 10 | Synthetic campus accounts → `/marketplace`, `/lost-found` | Listings/messages and lost/found claims; handover code expires after 15 minutes and locks after five incorrect attempts |
| 11 | Permitted account → `/reports` | Filter and inspect the synthetic attendance data |
| 12 | Any account → `/profile`, then scoped HOD/ADMIN | View personal/campus details; propose a detail/photo update, reject with feedback or approve it, inspect history and session controls. New accounts must complete `/change-password` before using the portal. See [account/profile setup](account-profile.md) |

A faculty/admin account without its own student profile cannot act as an arbitrary student for tutor/quiz testing. A user without their own faculty profile cannot create notes under someone else's name. SUPER_ADMIN is not permitted to mark attendance. Attendance empty states intentionally do not launch fabricated sessions.

## Recording or adding authenticated screenshots

Use [the capture checklist](screenshots/README.md). Never record passwords, tokens, OTPs, personal photos, or real student records. Identify the dataset as synthetic, state the captured role and route, and add an image only after visually inspecting it.

No published video URL has been supplied. If one is published later, add its actual URL here after verifying that it is accessible and contains only approved demonstration data. Until then, the repository links to this walkthrough rather than a nonexistent video.
