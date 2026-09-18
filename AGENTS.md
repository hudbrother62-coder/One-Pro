# Mobile Prototype Agent Guide

## One Pro product direction

- Product: One Pro Jurnal Digital.
- Selected visual direction combines Agenda Operasional and Pantauan Progres.
- Teacher screens must show operational data and actions immediately; avoid quotes, motivational copy, and decorative filler.
- Administrative screens prioritize schedules, attendance, targets, individual progress, incomplete journals, and actionable alerts.
- Brand asset uses the approved purple-magenta to navy-blue One Pro logo.
- The production experience must support light and dark themes and remain comfortable on mobile while scaling cleanly to desktop.

## Prototype Instructions

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.


## Dashboard and agenda decisions — 2026-09-17

- Operational home for Pengajar/PJ Kelompok must not use hardcoded class-of-the-day cards or hardcoded attendance percentages.
- Top dashboard summary prioritizes active class count, total stored student count, and current-month attendance percentage from recorded attendance data.
- Dashboard includes current-month average attendance by class and a five-month attendance comparison with the current month centered between two prior and two following months.
- Agenda calendar stays compact, surfaces saved recurring agenda items inside the matching calendar dates, and the selected calendar date must stay synchronized with the agenda list below.
- Use local calendar dates for agenda selection; do not derive date keys with UTC `toISOString()` when that can shift the visible date in Indonesian time zones.
- These presentation changes must reuse the existing data model and must not require Supabase schema changes.

## Journal, teacher-class, and AI analysis decisions — 2026-09-17

- PJ Kelompok assigns each Pengajar to a maximum of two active classes through `class_teachers`; Pengajar journal access is limited to assigned classes.
- Keep two journal modes structurally distinct: `Pengajian / Kelas` records session-level delivery and class conditions, while `Individu Siswa` records per-student target progress, observation, rubric scores, and follow-up. Do not render both modes as the same form.
- Journal scoring uses rubric version `one-pro-journal-v1`. Class session dimensions are material completion, class engagement, general understanding, and discipline/adab, each on a 1–4 scale. Individual dimensions are target progress, understanding, practice/skill, independence, and participation/adab, each on a 1–4 scale.
- Individual progress is persisted in `student_progress`, linked to the daily journal and target when available. Historic journal and attendance data must never be deleted by this workflow.
- Monthly AI analysis must use attendance, class journal entries, individual progress, and targets. The model must never invent facts; insufficient data must be called out explicitly. Persist generated analysis in `reports` and `ai_analyses` with a source hash for repeatability/cache.
- Monthly AI output should include summary, strengths, attention points, students needing support, concrete next actions, class recommendations, next-month focus, and data-quality status.



## Mobile navigation and organizational chat decisions — 2026-09-17

- Mobile uses a left-side navigation drawer opened from the top bar and the bottom Menu action. The drawer mirrors role-allowed desktop navigation and includes logout. Keep desktop sidebar behavior unchanged.
- Communication is contact-first, not thread-creation-first. Users never type a chat title or manually create a group thread. Contacts are derived from the organization hierarchy.
- Admin Daerah sees every Desa in its Daerah and every Kelompok beneath those Desa. Admin Desa sees its parent Daerah and every Kelompok under that Desa. PJ Kelompok/Pengajar sees its parent Desa and Daerah.
- Direct communication pairs are Daerah–Desa, Daerah–Kelompok, and Desa–Kelompok. Conversations and messages are stored in `org_conversations` and `org_messages`, protected by RLS and refreshed with Supabase Realtime.
- On mobile, contact list and conversation are separate views with an in-chat back button; on desktop they form a two-column WhatsApp-like workspace.


## Class database, attendance recap, and report-template decisions — 2026-09-17

- Reports are month-first: the user selects month and class before generating output. CSV, print, Word, and PPT must use only that selected month. PPT generation uses a valid uploaded placeholder template when available, otherwise the built-in professional ONE PRO deck.

- Class reports provide a built-in professional ONE PRO Word template (`.docx`) in addition to optional user-uploaded PowerPoint templates. Word output uses the monthly journal analysis internally but never labels the report as AI-generated.

- Calendar visual language uses a restrained surface card, soft selected-cell tint, gradient only on the selected date number, compact agenda chips, and fully themed date/month/time controls; avoid full-cell gradients or native gray browser controls.

- Database Anak has two views: Database Keseluruhan and Pembagian Kelas. The main student record remains the source of truth.
- A student may have only one active class enrollment. Moving/removing a student closes the prior `class_enrollments` row with `ended_on`; never delete enrollment history just to change class.
- PJ Kelompok manages class rosters and the lead Pengajar. A Pengajar can hold at most two classes. Journal and attendance should follow those assignments.
- Attendance includes daily entry and monthly recap. Monthly recap must show scheduled sessions, completed attendance, journal completion, missing dates, per-student Hadir/Izin/Alpha, and attendance percentage. Past missing dates remain editable.
- Report UI must not advertise AI. AI may prepare analysis in the background, but user-facing actions are ordinary report actions such as `Cetak`.
- PPT reports are template-driven, not arbitrary AI slide rewriting. Store `.pptx` templates in the private `report-templates` bucket and map controlled placeholders such as class, month, attendance, summary, strengths, attention points, and recommendations.
- Accept `.pptx` only, cap template size, preserve template versions, and validate placeholders/layout before automated PPT generation to avoid broken slides or fabricated content.


## Visual system decisions — 2026-09-18

- ONE PRO uses one restrained visual system across dashboard, agenda, journal, database/class assignment, attendance, reports, communication, team, targets, and settings. Keep purposeful purple/blue accents; avoid full-card gradients and heavy shadows.
- Desktop prioritizes readable 12–14px operational text, a centered content width around 1220px, calm flat surfaces, subtle active navigation, and compact action groups instead of full-width secondary buttons.
- Mobile preserves 44px-class touch targets, left navigation drawer plus quick bottom navigation, readable text, one-column forms, compact calendar cells, and horizontally scrollable data only where a true table cannot fit.
- Reuse the same border, radius, spacing, field, tab, button, card, and empty-state language across every feature. Strong elevation is reserved for floating overlays, drawers, modals, and toasts.
- On report screens, month/class selection is visually primary; Word and PPT outputs form a matched pair on desktop and stack on mobile.


## Scroll behavior decision — 2026-09-18

- ONE PRO uses a single primary page scroll for ordinary screens and long lists. Do not add nested vertical scrolling to student/team/target lists, class rosters, attendance entry, journal assessment lists, report cards, or agenda lists; nested scroll regions caused touch conflicts and inaccessible content on mobile.
- Independent vertical scrolling is reserved for navigation drawers/sidebars, long dialogs, and chat contact/message panes. True wide tabular content may use horizontal scrolling on mobile. Class selector cards may scroll horizontally on small screens.
- Long modals use their own viewport-safe scroll because they float above the page. Keep modal header/actions reachable and account for mobile dynamic viewport/safe-area insets.


## Regional admin monitoring decisions — 2026-09-18

- Admin Daerah and Admin Desa are monitoring/coordination layers, not operational data-entry roles. They may read scoped students, classes, schedules, attendance, journals, individual progress, reports, targets, accounts, and organizational chat, but attendance/journal/student/class/schedule mutations remain with PJ Kelompok or assigned Pengajar as appropriate.
- Admin Daerah scope is limited to its own Daerah and drills down Desa → Kelompok → Kelas. Admin Desa scope is limited to its own Desa and drills down Kelompok → Kelas. RLS is the authority; UI hiding alone is insufficient.
- Regional dashboards must use live scoped data, never hardcoded attendance/progress percentages. Show current-month attendance, journal completeness, unit counts, incomplete-data alerts, and students needing monitoring only when sufficient records exist.
- Admin Daerah can add/edit Desa and Kelompok in its Daerah. Admin Desa can add/edit Kelompok only in its Desa. Do not expose destructive delete for hierarchy units because operational history references them.
- Regional Presensi and Jurnal screens are read-only monitoring views. PJ Kelompok/Pengajar continue to submit operational records.
- Regional Database Anak is read-only. Student and class roster changes remain PJ Kelompok responsibilities.
- Targets are managed by Admin Daerah and read-only below that level.
- Regional reports remain month-first and add hierarchy filters: Admin Daerah can filter Desa → Kelompok → Kelas; Admin Desa can filter Kelompok → Kelas. Word/PPT generation requires one selected class for class reports.
- Tim & Akses follows hierarchical delegation: Admin Daerah manages Admin Desa/PJ/Pengajar within its Daerah; Admin Desa manages PJ/Pengajar within its Desa; PJ manages Pengajar within its Kelompok.
- Communication remains contact-first and two-way only across related hierarchy scopes; conversation opening and message access must remain RLS-protected.


## Super Admin, scoped monitoring, and mobile scroll — 2026-09-18

- Super Admin navigation is Beranda, Super Admin (accounts/access), AI Sistem, and Informasi. Do not show the normal Pengaturan screen to Super Admin.
- AI Sistem is Super-Admin-only and may answer about application architecture, role behavior, system health, hierarchy, and aggregate operational metrics. Do not send raw personal journal notes, addresses, phone numbers, passwords, tokens, service keys, or internal auth emails to the AI provider.
- Informasi is the human-readable system information screen: public production URL, stack, scoped counts, role responsibilities, and connection/security model.
- Admin Daerah/Admin Desa operational monitoring must be explicitly scoped before rendering detail. Use Kelompok → Kelas for Agenda, Presensi, Jurnal, Laporan, Database Anak, and Pembagian Kelas. Do not render a universal mixed calendar/report across multiple groups.
- Agenda calendar is class-specific after a group/class is selected; schedules from other groups/classes must not appear in calendar cells or the selected-date list.
- Mobile production uses browser-native touch scrolling for ordinary pages. App content opts out of simulated pointer-drag physics using data-scroll-drag=ignore while the underlying mobile scroll container uses native touch-action. Keep independent vertical scroll only for drawers, dialogs, chat panes, and other true overlays. Horizontal scrolling remains allowed for true wide/table/selector regions.
