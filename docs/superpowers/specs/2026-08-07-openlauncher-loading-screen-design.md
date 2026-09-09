# Loading Screen Design Spec

**Date**: 2026-08-07
**Project**: OpenLauncher
**Topic**: Loading screen with animated gradient, logo switching, and progress bar
**Status**: Awaiting user review

---

## 1. Purpose

Add a full-screen loading screen that displays during the application's initialization phase. The screen shows a flowing liquid-like gradient background, an alternating logo (black/white) that maintains contrast against the shifting background, and a loading bar that animates for 5–7 seconds.

## 2. Context

### 2.1 Project Stack
- **Electron 43** + **React 19** + **Vite** (bundler)
- Entry point: `src/main.jsx` → renders `<App />` inside `<I18nProvider>`
- `App.jsx` (~2350 lines) is the single-page app component
- `electron/main.js` creates BrowserWindow with `backgroundColor: '#0e0e0e'`, `frame: false`
- Preload bridge: `electron/preload.cjs` exposes `window.launcher` IPC object
- In dev mode, a mock `launcher` object provides safe fallbacks

### 2.2 Current Behavior
There is **no splash or loading screen**. The Electron window opens immediately to `#0e0e0e` and the React app renders. `App.jsx` fetches data asynchronously (profiles, versions, auth, news, app version) with a `stateHydrated` flag, but the UI is visible immediately — just not fully populated.

### 2.3 Existing Design Tokens
From `src/App.css`:
- `--bg-void: #0b090a`
- `--bg-deep: #161a1d`
- `--accent: #ba181b`
- `--danger: #e5383b`
- `--text-secondary: #d3d3d3`

The user's requested gradient colors (`#e5383b`, `#161a1d`, `#d3d3d3`) map directly to `--danger`, `--bg-deep`, and `--text-secondary`.

### 2.4 Logo Assets
- `src/assets/1.png` — black logo (713×651, RGBA PNG)
- `src/assets/12.png` — white logo (713×651, RGBA PNG)

---

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| R1 | Show loading screen during program initialization | User request |
| R2 | Gradient of 3 colors: `#e5383b`, `#161a1d`, `#d3d3d3` | User request |
| R3 | Gradient must be dynamic — flowing liquid animation with blur | User request |
| R4 | Logo displayed in a square box; alternate between black (1.png) and white (12.png) | User request |
| R5 | Logo must dynamically adapt colors vs. background for visible contrast | User request + clarified: alternate assets |
| R6 | Loading bar that lasts between 5–7 seconds | User request |
| R7 | Pure CSS implementation (no extra JS dependencies) | Clarified from user |
| R8 | Fixed 5–7s delay for dismissal (not tied to real init completion) | Clarified from user |

---

## 4. Design Decisions

### 4.1 Approach: CSS-animated gradient overlay (Approach A)
A React component rendered as a fixed full-screen overlay, positioned above the titlebar and app layout. Uses pure CSS for all animations. The overlay fades out and unmounts after 6 seconds (midpoint of 5–7s range), then reveals the app.

**Rationale**: Cleanest fit for a Vite + React + Electron stack. Zero new dependencies. Leverages existing design tokens.

### 4.2 Logo Alternation Strategy
Two `<img>` elements (black and white) are rendered in a stack. A CSS animation (`logoSwap`) alternates which is visible every 2.5 seconds. Because the gradient background continuously shifts through all 3 colors, each logo variant is guaranteed to be visible against a contrasting color region when it appears.

### 4.3 Liquid Flow Animation Technique
- A pseudo-element (`::before`) behind the content carries the animated gradient
- Uses `linear-gradient(270deg, #e5383b, #161a1d, #d3d3d3)` with animated `background-position` (0% → 100% over 8s, looped infinitely)
- A secondary radial gradient layer adds depth variation
- `filter: blur(12px)` on the gradient layer creates the liquid-diffusion effect
- A subtle `transform: scale(1.05)` pulse adds organic motion
- Multiple layered gradients at different speeds create a parallax liquid-flow feel

### 4.4 Timing Strategy
- Fixed 6-second duration (within the 5–7s range)
- `useEffect` with `setTimeout` triggers the fade-out after 6s
- A progress simulation increments from 0→100% to drive the loading bar visually
- The loading bar uses `cubic-bezier(0.25, 0.1, 0.25, 1)` easing for a natural flow
- After fade-out, `onFinish` callback unmounts the loading screen and shows the app

### 4.5 Integration Point
Modified `src/main.jsx` to introduce a `showApp` state:

```jsx
// Before:
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider><App /></I18nProvider>
  </StrictMode>,
)

// After:
function Root() {
  const [showApp, setShowApp] = useState(false);
  return showApp ? <App /> : <LoadingScreen onFinish={() => setShowApp(true)} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </StrictMode>,
)
```

This ensures the loading screen appears before `<App />` mounts, and the app only renders after the loading screen completes.

---

## 5. Component Structure

### 5.1 `src/components/LoadingScreen.jsx`
Props:
- `onFinish: () => void` — called after the loading bar completes

State:
- `progress: number` (0–100) — driven by setInterval
- `visible: boolean` — controls fade-out

Render:
1. `<div className="loading-screen">` — fixed full-screen overlay
2. `<div className="loading-liquid">` — animated gradient background with blur
3. `<div className="loading-logo">` — square box containing alternating black/white logo images
4. `<div className="loading-bar-container">` — contains the progress bar
5. `<div className="loading-bar-fill">` — animated progress bar

### 5.2 CSS (in `src/App.css`)
New CSS rules for `.loading-screen`, `.loading-liquid`, `.loading-logo`, `.loading-bar-container`, `.loading-bar-fill`, plus `@keyframes` for `liquidFlow`, `logoSwap`, `barFill`, and `fadeOut`.

---

## 6. Data Flow

```
main.jsx renders <Root />
  └── Root: showApp = false
      └── renders <LoadingScreen onFinish={() => setShowApp(true)} />
          │
          ├── progress 0 → 100% over 6 seconds (setInterval)
          ├── loading bar animates in sync
          ├── logo alternates black/white every 2.5s
          ├── liquid gradient flows continuously
          │
          └── after 6s:
              └── fade-out animation (300ms)
              └── onFinish() → showApp = true
                  └── renders <App /> (unmounts LoadingScreen)
```

---

## 7. Error Handling

| Scenario | Handling |
|---|---|
| Component fails to mount | Window shows `backgroundColor: '#0e0e0e'` as fallback (existing Electron behavior) |
| Logo image fails to load | `onError` handler hides the broken image, no crash |
| `onFinish` never called | Fallback: `onFinish` always fires after 6s via `setTimeout`, regardless of progress state |
| Dev mode (mock launcher) | Loading screen shows regardless — it's purely cosmetic, no IPC dependency |

---

## 8. Testing

No formal test framework exists in this project. Verification will be manual:

1. Start the app in dev mode (`npm run dev`) — verify loading screen appears before app
2. Verify loading bar fills in ~6s
3. Verify logo alternates between black and white
4. Verify gradient flows with blur effect
5. Verify app appears after loading screen fades out
6. Verify no visual artifacts or layout shift on transition

---

## 9. Open Questions (Resolved)

| Question | Resolution |
|---|---|
| Logo: alternate, blend-mode, or SVG mask? | Alternate between 1.png (black) and 12.png (white) |
| Fixed delay or real-init gated? | Fixed 6s (within 5–7s range), not tied to real init |
| CSS, Canvas, or WebGL? | Pure CSS |

---

## 10. Out of Scope

- Real progress reporting from IPC (the bar is cosmetic, not tied to actual init)
- Custom splash window in `main.js` (Approach C rejected)
- SVG logo conversion
- Sound effects or interactivity
