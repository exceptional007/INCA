# Mobile UI review — 1 November 2026

## Scope and changes

The Netlify project badge was disabled in **Project configuration → General → Powered by Netlify badge**. This is a hosting setting for every visitor, rather than a browser-local dismissal or CSS workaround.

The frontend keeps its existing React, Tailwind, Radix, and routing architecture. The review corrected:

- Admin and coordinator dashboard navigation expanding beyond narrow screens.
- Scheduling tabs and academic action toolbars overflowing on phones.
- Academic, faculty/student administration, lecture, notice, and poll form fields remaining in crowded columns.
- Notice publication, lost-item details, and document replacement actions being clipped.
- Quiz, tutor, document preview, and marketplace chat headers exceeding their available width.
- Dialogs exceeding short viewports; close controls and stacked footer spacing.
- Lost-and-found notifications extending outside the screen.
- Report roster controls and identity details failing to wrap.
- Landing-page desktop navigation appearing too early at tablet widths.
- Mobile sidebar remaining open after navigation and hiding its close button.
- Breadcrumb `asChild` rendering nested anchors rather than composing the existing router link.

Shared form fields use a 16px font on phones to avoid focus-triggered iOS zoom. Data tables and long tab bars retain their own horizontal scrolling; the page itself is not globally clipped to hide overflow.

## Verification performed

Browser layout checks used synthetic localhost data and viewport widths of **320, 375, 640, 768, 1024, and 1440px**. Different screen groups were checked at the relevant breakpoints, rather than claiming every state was exercised at every dimension.

| Area | Coverage |
| --- | --- |
| Primary authenticated pages | Hub, dashboard, academic master, scheduling, timetable import, activities, reports, notes, marketplace, lost and found, notices, polls, profile, attendance |
| Role dashboards | SUPER_ADMIN, ADMIN, HOD, COORDINATOR, FACULTY, STUDENT |
| Public/account pages | Landing, login, password recovery, password reset |
| Academic navigation | Programs, subjects, rooms, faculty, students; timetable upload and history |
| Creation/update forms | Program, listing, lost-item report, notice, poll, profile update, note upload/edit/replacement, lecture, timetable upload |
| Detail/interaction panels | Marketplace listing/report/review/chat, lost-item detail/claim/handover/AI matches, poll vote/results/voter report, document preview, AI tutor/quiz, notice detail/analytics/review |
| Reports/attendance | Institutional overview; student, section, subject and faculty drilldowns; populated attendance swipe card |
| Navigation | Phone drawer opens, exposes Close, and closes after selecting a destination; landing menu at tablet width |
| Short screens | Approval, quiz, tutor, chat and import previews at 320 × 640 |

Final primary-page checks at 320px and desktop checks at 1440px found no document-wide horizontal overflow. Narrow-screen detail checks specifically rechecked the clipped controls found during the review. Production frontend build passes. Lint completes with warnings; this work does not attempt to resolve the existing hook and compiler-advisory warnings across the application.

These are layout and interaction checks, not production user-account or business-workflow tests. No live attendance, publication, approval, password, mail, payment, or storage mutations were used. Real iOS/Android keyboard behavior and every possible user-supplied content combination still warrant device testing.

## Reproduce safely

From `frontend`, run:

```sh
node scripts/mobile-preview-server.mjs
```

Open `http://127.0.0.1:5187/__fixture?role=ADMIN&page=/hub`. Replace `ADMIN` with another supported role, or choose a route in `page`. The server is bound to loopback, disables `.env` loading, intercepts API requests with synthetic responses, and does not connect to the production backend. Do not expose this development preview publicly.

For isolated populated components, use `http://127.0.0.1:5187/__components?case=quiz`. Other cases are listed in `frontend/scripts/mobile-component-gallery.tsx`. The preview files are not imported by the production application or included as application routes.
