# OpenLauncher GUI Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive responsive design for width AND height so all GUI elements fit and rearrange correctly at any viewport size.

**Architecture:** Single CSS file refactor (`src/App.css`) with fluid variables, improved breakpoints, and height-aware layouts. Minor JSX changes in `App.jsx` and `CentralCard.jsx` for flexible containers.

**Tech Stack:** CSS custom properties, `@media` queries, CSS Grid/Flexbox, `clamp()`, `aspect-ratio`, viewport-relative units.

## Global Constraints
- Maintain existing dark theme aesthetic (no light theme)
- Breakpoint floor: 360px width minimum
- All interactive elements must remain usable at 360px width
- Preserve existing component class names to avoid breaking App.jsx/JSX
- No new dependencies

---

### Task 1: Fluid CSS Variables & New Breakpoints

**Files:**
- Modify: `src/App.css:11-46`

**Interfaces:**
- Consumes: None
- Produces: `--page-gutter`, `--sidebar-width`, `--radius-*` fluid values, `--gap-xs/md/lg`, `--font-size-*` scales, new breakpoints

**Why:** Current variables are semi-fluid. We need tighter clamping and new breakpoints for small screens (<390px, 390–768px).

- [ ] **Step 1: Replace `:root` variables with fluid values**

```css
:root {
  /* Existing colors - keep unchanged */
  --bg-void: #0b090a;
  --bg-deep: #161a1d;
  /* ... all color variables remain ... */

  /* Fluid spacing */
  --page-gutter: clamp(12px, 2vw, 40px);
  --gap-xs: clamp(6px, 1.5vw, 10px);
  --gap-sm: clamp(8px, 2vw, 14px);
  --gap-md: clamp(12px, 2.5vw, 20px);
  --gap-lg: clamp(16px, 3vw, 32px);

  /* Fluid fonts */
  --font-size-xs: clamp(10px, 2vw, 11px);
  --font-size-sm: clamp(11px, 2.2vw, 13px);
  --font-size-base: clamp(13px, 2.6vw, 16px);
  --font-size-md: clamp(15px, 3vw, 15px); /* locked at 15 */
  --font-size-lg: clamp(18px, 4vw, 22px);
  --font-size-xl: clamp(24px, 5vw, 32px);
  --font-size-xxl: clamp(32px, 7vw, 40px);

  /* Fluid radii */
  --radius-sm: clamp(6px, 1vw, 8px);
  --radius-md: clamp(8px, 1.2vw, 12px);
  --radius-lg: clamp(12px, 2vw, 20px);
  --radius-xl: clamp(18px, 3vw, 24px);

  /* Fluid sidebar */
  --sidebar-width: clamp(260px, 22vw, 380px);

  /* Title bar (fixed height) */
  --titlebar-height: 42px;
  --titlebar-height-sm: 38px; /* mobile height */
}
```

- [ ] **Step 2: Update titlebar height variable usage for mobile**

```css
@media (max-width: 480px) {
  :root {
    --titlebar-height: 38px;
  }
}
```

- [ ] **Step 3: Run build to check for variable conflicts**

Run: `npm run build` (or equivalent)
Expected: No CSS compile errors

---

### Task 2: Mobile-First Titlebar Layout

**Files:**
- Modify: `src/App.css:91-179`

**Interfaces:**
- Consumes: `--titlebar-height`, `--page-gutter`
- Produces: Responsive titlebar that shrinks gracefully on mobile

**Why:** Current titlebar doesn't handle < 480px screens well - buttons get cramped.

- [ ] **Step 1: Add responsive titlebar styles**

```css
/* Existing titlebar styles remain, add responsive overrides */
@media (max-width: 480px) {
  .titlebar {
    padding: 0 8px 0 10px;
    height: var(--titlebar-height);
  }

  .titlebar-name {
    font-size: 12px;
  }

  .titlebar-version {
    font-size: 8px;
    padding: 2px 6px;
  }

  .titlebar-logo {
    width: 16px;
    height: 16px;
  }

  .titlebar-brand {
    gap: 6px;
  }

  .titlebar-controls {
    gap: 2px;
  }

  .win-btn {
    width: 28px;
    height: 24px;
    font-size: 10px;
  }
}
```

---

### Task 3: Height-Aware App Layout

**Files:**
- Modify: `src/App.css:182-190`

**Interfaces:**
- Consumes: `--titlebar-height`
- Produces: Layout that handles both short and tall viewports

**Why:** Current layout uses `100vh - titlebar` which breaks on mobile browsers with dynamic toolbars. Need `100dvh` and min-height handling.

- [ ] **Step 1: Replace fixed height with dynamic viewport units**

```css
.app-layout {
  width: 100%;
  /* dvh = dynamic viewport height, handles mobile browser UI */
  height: calc(100dvh - var(--titlebar-height));
  min-height: calc(100dvh - var(--titlebar-height));
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  grid-template-rows: 1fr;
  overflow: hidden;
  gap: 0;
}

/* Ensure content areas don't exceed viewport */
.main-content {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0; /* critical for flexbox child overflow */
}
```

- [ ] **Step 2: Add height-aware sidebar**

```css
.sidebar {
  background: rgba(11, 9, 10, 0.8);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(16px);
  /* Allow sidebar to scroll if content exceeds viewport */
  height: calc(100dvh - var(--titlebar-height));
  min-height: 0;
}
```

---

### Task 4: Small Screen Layout (< 480px)

**Files:**
- Modify: `src/App.css:2207-2315` (existing 700px media query area)

**Interfaces:**
- Consumes: `app-layout`, `.sidebar` classes
- Produces: Collapsible sidebar, stacked layout for mobile

**Why:** Current 700px breakpoint completely hides sidebar. Need a mobile-friendly approach with collapsible sidebar that still shows navigation.

- [ ] **Step 1: Add 480px breakpoint before existing 700px**

```css
/* NEW: Very small screens */
@media (max-width: 480px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    /* On mobile, hide sidebar but keep accessible */
    position: absolute;
    left: 0;
    top: var(--titlebar-height);
    width: min(280px, 85vw);
    height: calc(100dvh - var(--titlebar-height));
    z-index: 150;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar.expanded {
    transform: translateX(0);
  }

  .sidebar-overlay {
    position: fixed;
    inset: var(--titlebar-height) 0 0 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 140;
    display: none;
  }

  .sidebar-overlay.active {
    display: block;
  }

  /* Action bar - reduce gap on mobile */
  .action-bar {
    gap: 6px;
    padding: 12px var(--page-gutter) 11px;
  }

  .action-btn {
    flex: 1 1 auto;
    font-size: 11px;
    padding: 8px 12px;
    min-width: 0;
  }

  /* Bottom bar - stack on mobile */
  .bottom-bar {
    flex-direction: column;
    align-items stretch;
    gap: 8px;
    padding: 12px var(--page-gutter);
  }

  .version-selector {
    flex-direction: column;
    gap: 6px;
  }

  .play-btn {
    width: 100%;
    font-size: 13px;
  }

  /* Reduce console header gap */
  .console-header {
    padding: 8px 0 0;
  }

  .console-body {
    font-size: var(--font-size-xs);
    padding: 14px 16px;
  }

  /* Mod grid - 1 or 2 columns on mobile */
  .mod-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  /* News grid - single column */
  .news-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  /* Toast stack - full width on mobile */
  .toast-stack {
    left: 10px;
    right: 10px;
    top: calc(var(--titlebar-height) + 10px);
    max-width: none;
  }

  /* Tabs - scrollable on mobile */
  .content-tabs {
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
  }

  /* Hide scrollbar but keep functionality on mobile */
  .content-tabs::-webkit-scrollbar {
    height: 3px;
  }

  .content-tabs::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
  }
}
```

---

### Task 5: Tablet Layout (481px – 768px)

**Files:**
- Modify: `src/App.css` (new media query section)

**Interfaces:**
- Consumes: `.sidebar`, `.app-layout`
- Produces: Narrow sidebar, condensed main content

**Why:** Between mobile and desktop, sidebar should be narrower but still visible. Modals should adapt.

- [ ] **Step 1: Add tablet breakpoint**

```css
@media (min-width: 481px) and (max-width: 768px) {
  .app-layout {
    grid-template-columns: 280px 1fr;
  }

  .action-btn {
    font-size: 11px;
    padding: 8px 12px;
  }

  .bottom-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .version-selector {
    flex: 1 1 50%;
    min-width: 200px;
  }

  .ram-indicator {
    flex: 1 1 40%;
    justify-content: center;
  }

  .play-btn {
    flex: 1 1 100%;
  }

  .mod-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .news-grid {
    grid-template-columns: 1fr;
  }

  .settings-row {
    padding: 14px 16px;
  }

  .tab-panel {
    padding: 14px var(--page-gutter);
  }
}
```

---

### Task 6: Height Constraints for Short Viewports

**Files:**
- Modify: `src/App.css` (modal heights, console height)

**Interfaces:**
- Consumes: `.modal`, `.console-body`, `.tab-panel`
- Produces: Scrollable areas that respect available height

**Why:** On short screens (laptops ~13"), modals and console overflow. Need `max-height` with scrolling.

- [ ] **Step 1: Modal height constraints**

```css
.modal {
  max-height: calc(100dvh - var(--titlebar-height) - 40px);
  overflow-y: auto;
}

/* Settings modal with scrollable content section */
.settings-section {
  max-height: calc(100dvh - var(--titlebar-height) - 200px);
  overflow-y: auto;
  padding-right: 6px;
}
```

- [ ] **Step 2: Console body height handling**

```css
.console-body {
  /* Already has flex: 1, add explicit min-height */
  min-height: 180px;
  max-height: calc(100dvh - var(--titlebar-height) - 140px);
}

/* Tab panels need min-height to fill remaining space */
.tab-panel {
  min-height: 0; /* Allow shrinking */
}
```

---

### Task 7: Beginner Mode Responsiveness

**Files:**
- Modify: `src/App.css:3155-3520` (beginner mode section)
- Modify: `src/components/CentralCard.jsx:21-22` (beginner-card class)

**Interfaces:**
- Consumes: `.beginner-mode`, `.beginner-card`
- Produces: Card that adapts to all screen sizes

**Why:** CentralCard has `width: min(420px, 90vw)` but doesn't handle very short screens or ensure all form elements fit.

- [ ] **Step 1: Update beginner-mode container**

```css
.beginner-mode {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--page-gutter);
  min-height: calc(100dvh - var(--titlebar-height));
  overflow: auto;
}

.beginner-card {
  background: linear-gradient(180deg, rgba(22, 26, 35, 0.96), rgba(17, 19, 23, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: clamp(20px, 3vw, 24px);
  padding: clamp(28px, 5vw, 42px) clamp(28px, 5vw, 48px);
  width: min(420px, 92vw);
  max-height: min(90dvh, 780px);
  overflow-y: auto;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Update beginner form elements for responsiveness**

```css
.beginner-form {
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 2vw, 14px);
  margin-bottom: clamp(20px, 4vw, 28px);
}

.beginner-input {
  padding: clamp(10px, 2vw, 12px) clamp(14px, 3vw, 16px);
  font-size: clamp(13px, 2.5vw, 15px);
}

.beginner-select {
  padding: clamp(10px, 2vw, 12px) clamp(14px, 3vw, 16px);
  font-size: clamp(12px, 2.2vw, 14px);
}

.beginner-play-btn {
  padding: clamp(12px, 2.5vw, 14px);
  font-size: clamp(13px, 2.5vw, 15px);
}

.beginner-presets {
  display: flex;
  gap: clamp(6px, 1.5vw, 10px);
  flex-wrap: wrap;
  margin-bottom: clamp(14px, 3vw, 20px);
}

.beginner-presets button {
  flex: 1 1 clamp(80px, 25vw, 120px);
  padding: clamp(8px, 2vw, 10px) clamp(8px, 2vw, 12px);
  font-size: clamp(10px, 2vw, 12px);
}

.beginner-divider {
  margin: clamp(12px, 3vw, 18px) 0;
  font-size: clamp(8px, 1.5vw, 10px);
}
```

- [ ] **Step 3: Beginner install section responsiveness**

```css
.beginner-install-row {
  display: flex;
  gap: clamp(6px, 2vw, 10px);
  align-items: flex-end;
}

.beginner-install-row .beginner-select {
  flex: 1 1 140px;
  min-width: 0;
}

.beginner-install-btn {
  flex: 0 0 auto;
  padding: clamp(10px, 2vw, 12px) clamp(14px, 3vw, 20px);
  font-size: clamp(11px, 2vw, 13px);
  white-space: nowrap;
}

/* On very small screens, stack install row */
@media (max-width: 400px) {
  .beginner-install-row {
    flex-direction: column;
    align-items: stretch;
  }

  .beginner-install-btn {
    width: 100%;
  }
}
```

---

### Task 8: Console Header & Controls Responsiveness

**Files:**
- Modify: `src/App.css` (console section)
- Modify: `src/App.jsx:3040-3124` (console actions inline styles)

**Interfaces:**
- Consumes: `.console-header`, `.console-actions`
- Produces: Console actions that wrap on small screens

**Why:** Console header has filter buttons and actions that overflow on mobile.

- [ ] **Step 1: Update console header for mobile wrap**

Add to App.jsx console header section:
```jsx
<div className="console-actions" style={{
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "wrap", // Add wrap
}}>
```

- [ ] **Step 2: CSS for wrapped console actions**

```css
.console-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.console-actions .console-icon-btn {
  flex: 0 0 auto;
}

/* Log filter buttons - reduce on mobile */
@media (max-width: 480px) {
  .console-actions > div:first-child {
    /* The filter wrapper */
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  .console-actions .console-icon-btn[style*="width: 48px"] {
    width: 36px !important;
    fontSize: 8px !important;
    padding: 2px 4px !important;
  }
}
```

---

### Task 9: Mod Grid & News Card Responsiveness

**Files:**
- Modify: `src/App.css` (mod-grid, news-grid)

**Interfaces:**
- Consumes: `.mod-grid`, `.news-grid`
- Produces: Better responsive grids

**Why:** Mod grid already uses `auto-fit` but needs tighter min width for mobile. News cards need height adaptation.

- [ ] **Step 1: Update mod grid for all sizes**

```css
.mod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(180px, 40vw, 230px), 1fr));
  gap: clamp(10px, 2vw, 14px);
}

/* News grid responsive */
.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 80vw, 280px), 1fr));
  gap: clamp(12px, 3vw, 16px);
  align-items: stretch;
}

.news-card {
  /* Ensure min height for readability */
  min-height: 260px;
}

.news-card-media {
  /* Responsive aspect ratio */
  aspect-ratio: 16 / 9;
}

/* Mod search input on mobile */
@media (max-width: 480px) {
  .mod-card-name {
    font-size: 13px;
  }

  .mod-card-ver {
    font-size: 9px;
  }

  .mod-card-actions {
    flex-wrap: wrap;
    gap: 4px;
  }
}
```

---

### Task 10: Settings Modal Height & Layout

**Files:**
- Modify: `src/App.css` (settings section ~2615-2698)

**Interfaces:**
- Consumes: `.settings-section`, `.settings-row`
- Produces: Settings modal that scrolls instead of overflowing

**Why:** SettingsSection has `max-height: 60vh` but needs better handling for short screens.

- [ ] **Step 1: Update settings modal for height responsiveness**

```css
.settings-section {
  max-height: calc(100dvh - var(--titlebar-height) - 240px);
  overflow-y: auto;
  padding-right: 6px;
  margin-bottom: 24px;
}

@media (max-width: 480px) {
  .settings-section {
    max-height: calc(100dvh - var(--titlebar-height) - 220px);
  }

  .settings-actions {
    flex-direction: column-reverse;
  }

  .settings-actions-secondary {
    flex-direction: column;
    width: 100%;
  }

  .settings-done-btn {
    width: 100%;
  }
}
```

---

### Task 11: Bottom Bar Height Management

**Files:**
- Modify: `src/App.css` (bottom-bar section)

**Interfaces:**
- Consumes: `.bottom-bar`
- Produces: Bottom bar that adapts to available height

**Why:** Bottom bar has fixed padding that can push content off-screen on short viewports.

- [ ] **Step 1: Add height-constrained bottom bar**

```css
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(10px, 2vw, 14px) var(--page-gutter);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(11, 9, 10, 0.86);
  flex-shrink: 0;
  gap: clamp(8px, 2vw, 12px);
  backdrop-filter: blur(16px);
  max-height: 100px; /* Prevent excessive height on short screens */
}

@media (max-width: 480px) {
  .bottom-bar {
    max-height: 140px;
  }
}
```

---

### Task 12: Build & Verify

**Files:**
- Verify: All modified files

**Interfaces:**
- N/A

- [ ] **Step 1: Run build to verify no errors**

Run: `npm run build`
Expected: Successful build with no CSS errors

- [ ] **Step 2: Verify responsive behavior**

Run: `npm run start` (Electron app)
Expected:
- At 360px width: Sidebar hidden, action buttons stacked, play btn full width
- At 768px: Sidebar visible (280px), mod grid 2 cols, bottom bar flex-wrap
- At 1024px+: Full layout as before
- Short height (~800px): Console scrollable, settings scrolls, modals fit
- Beginner mode: Card centered, all inputs visible, presets wrap
