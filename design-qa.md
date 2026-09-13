# Design QA — Responsive Production Shell

## Evidence

- Source problem: `/workspace/scratch/714b6e8b5266/upload/f227b05d-41ca-478d-b023-39eda15177aa.png` (desktop browser incorrectly showing a framed iPhone app).
- Implementation: `https://one-pro-cyan.vercel.app/?preview=1`, deployment commit `d12b91d`.
- Browser-rendered desktop capture: cloud Chrome tab 1, captured inline during QA.
- Desktop viewport: 1363 × 936 CSS px, device scale factor 1.
- State: dark theme, PJ Kelompok dashboard.
- Interactions tested: desktop navigation to Database Anak, open/close Add Student editor, navigation to Attendance, and preview role selection.
- Console checked: no application-origin errors; two logged errors came from the cloud-browser extension URL.

## Full-view comparison

The P0 issue in the supplied screenshot is resolved. On desktop, the browser viewport is now occupied by a native desktop shell: 256 px sidebar, 76 px application header, wide data canvas, two-column dashboard composition, and no phone bezel or device picker. The production screen measured 1363 × 936 CSS px and had no horizontal overflow.

## Focused comparison

- Navigation: all 10 feature destinations are visible in the desktop sidebar; bottom navigation is hidden at desktop width.
- Brand: the supplied One Pro purple/navy mark is visible in the sidebar.
- Data canvas: dashboard cards scale to the remaining 1107 px content width instead of staying at phone width.
- Runtime chrome: phone bezel, simulated status bar, camera, home indicator, keyboard asset, and device picker are hidden in production viewport CSS.

## Required fidelity surfaces

- Fonts and typography: Plus Jakarta Sans Variable remains bundled; desktop headings, data values, row labels, and sidebar labels use larger desktop-specific sizes.
- Spacing and layout rhythm: desktop uses a fixed sidebar and centered content canvas; mobile retains single-column spacing, safe-area padding, and bottom navigation.
- Colors and tokens: the existing light/dark semantic token system is preserved.
- Image quality and asset fidelity: supplied One Pro SVG is used directly and cropped to the mark; no placeholder logo remains.
- Copy and content: screens remain data/action-first with no decorative filler.

## Comparison history

### Iteration 1

- [P0] Desktop rendered a centered phone mockup rather than a desktop application.
- Fix: production CSS expands the device screen to the real browser viewport and hides all preview-only device chrome.
- Post-fix evidence: browser measurement reports `phoneFrameHidden: true`, `sidebarVisible: true`, `bottomNavHidden: true`, and `overflowX: false`.

### Iteration 2

- [P2] The logo crop showed a white tile in the first desktop capture.
- Fix: aligned the supplied square logo to the top of its cropped container.
- Post-fix evidence: latest browser capture visibly shows the purple/navy chart mark in the sidebar.

## Findings

- [P2] A browser-rendered narrow mobile capture could not be produced by the fixed-size cloud browser in this run. The mobile breakpoint is implemented in CSS and retains bottom navigation while hiding the desktop sidebar, but it still requires a device-width visual capture before the responsive QA gate can be closed.

## Implementation checklist

- [x] Native desktop shell
- [x] Phone preview chrome removed from production viewport
- [x] Desktop sidebar and wide dashboard
- [x] Light/dark theme preserved
- [x] Desktop primary navigation and editor interaction verified
- [ ] Browser-rendered 390 px mobile regression capture

final result: blocked
