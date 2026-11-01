# Landing page and product experience refresh

Updated 1 November 2026. The existing React, Tailwind, GSAP, and attendance implementation are retained. No dependencies or database changes are required.

## What changed

- Rebuilt the landing page with a compact navigation, clearer hero, install entry points, product tour, dedicated swipe section, connected feature cards, workflow, and footer.
- Replaced the overflowing horizontal showcase tabs with a wrapping, keyboard-accessible grid covering attendance, timetables, notices, notes/AI, marketplace, lost and found, polls, reports, academic master data, and profile.
- Removed manually recreated mock tables, invented activity figures, and the hardcoded tutor conversation. Product previews are captures of the existing application and its lecture card, produced locally with sample data. They are explicitly labelled screenshots/sample data, with links to the real authenticated workspaces. They are not presented as live campus records or clickable replicas.
- Preview images use their intrinsic dimensions and natural height, without a fixed-height crop. The image/description columns stack on phones. Image dimensions reserve space before loading; only the active preview loads.
- Added a working public attendance practice section using the same `CardSwipeAttendance` component as the faculty workflow. Three fictional students are kept in React state only. No public practice action sends attendance to the backend.
- A GSAP finger gesture starts when the practice stage enters view, demonstrates present/absent through the existing card-marking logic, then hands control to the visitor. It stops offscreen or when the visitor interacts, and includes pause/replay. Reduced-motion preferences suppress automatic motion.
- Added GSAP hover/focus lifts, short tab entrance transitions, staggered breadcrumb transitions, and one-time section reveals. Native smooth anchor scrolling is scoped to the landing page; no scroll hijacking or perpetual animation loop is used. Animation instances/listeners are cleaned up on unmount and motion-preference changes.
- Feature cards and hero shortcuts select the corresponding product tab. Breadcrumbs now name the notes, marketplace, lost-and-found, notices, and polls modules correctly.
- Attendance submission is disabled until every displayed student is marked, and unmarked summary rows no longer appear preselected as present. The faculty workflow's existing prepared-present defaults are preserved. A failed profile-photo decode now falls back to the existing profile silhouette.

## Verification

- All **10 previews at 320, 390, 768, and 1440px**: 40 checks confirmed images fit their panels, load successfully, and do not cause document-wide horizontal overflow.
- Keyboard Home/End tab selection, selected-state semantics, mobile menu opening/Escape/focus return, anonymous sign-in links, and module entry links checked.
- Automatic swipe demonstration reached the third student with **one present and one absent**. Manual pointer drags right/left produced the same statuses on the phone viewport.
- Manual late marking, summary counts, practice completion, disabled locked controls, replay, and pause checked with synthetic data.
- Existing application breadcrumb route navigation checked. No live campus mutations were used.
- Frontend TypeScript/Vite/Netlify build and lint pass (lint retains advisory warnings). The 11 offline attendance protocol tests pass.

Browser viewport checks do not replace physical iOS/Android acceptance testing. Screen previews are captures of implemented UI states, not a public end-to-end backend demo. Campus data, AI requests, approvals, and transactions continue to require the existing authenticated workspaces.

GSAP implementation follows its [matchMedia and reduced-motion guidance](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/).

Public assets are in `frontend/public/product-screens/`. Their dimensions are recorded in `frontend/src/components/landing/screen-dimensions.json`. The local fixture server/component gallery can reproduce the sample screens; no production records or credentials are embedded.
