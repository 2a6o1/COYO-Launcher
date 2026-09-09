# Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen loading screen that displays a flowing 3-color gradient (e5383b, 161a1d, d3d3d3) with blur, alternating black/white logo, and a 6-second progress bar — appearing before the main app mounts.

**Architecture:** A new `LoadingScreen` React component rendered as a fixed-position overlay at the root level. It gates the `<App />` behind a `showApp` state in `main.jsx`. The loading screen runs for a fixed 6-second duration (within the 5–7s range), simulates progress via `setInterval`, then fades out and calls `onFinish` to mount the app. Pure CSS animations handle the liquid flow, logo swap, and progress bar — no new dependencies.

**Tech Stack:** React 19, Vite (Vite handles asset imports), Electron 43, plain CSS (PostCSS nesting), no test framework (manual verification only).

## Global Constraints

- React 19 — use `useState`, `useEffect` hooks (no class components, no external state libs)
- Vite bundler — asset imports use `import img from '../assets/x.png'` syntax
- No test framework in the project — verification is manual via `npm run dev`
- CSS: plain CSS with CSS custom properties, matching existing `App.css` patterns (section comments, `--variable` tokens)
- Duration: fixed 6 seconds (within 5–7s range), not tied to real IPC init
- Assets: use existing `src/assets/1.png` (black, 713×651) and `src/assets/12.png` (white, 713×651)
- Colors: `#e5383b` (danger), `#161a1d` (bg-deep), `#d3d3d3` (text-secondary) — all are existing design tokens

---

## File Structure

```
src/
├── components/
│   └── LoadingScreen.jsx      ← CREATE (new file)
├── main.jsx                    ← MODIFY (add showApp gating + import)
├── App.css                     ← MODIFY (append loading screen CSS at end)
├── assets/
│   ├── 1.png                   ← EXISTS (black logo, used by new import)
│   └── 12.png                  ← EXISTS (white logo, used by new import)
```

### File Responsibilities

1. **`src/components/LoadingScreen.jsx`** — Self-contained React component. Manages its own timer, progress state, and fade-out. Calls `onFinish()` when done. No dependency on app state or IPC.
2. **`src/main.jsx`** — Wraps `<App />` behind a `showApp` boolean. Renders `<LoadingScreen>` until `onFinish` fires.
3. **`src/App.css`** — Appends all loading screen CSS rules + keyframes at the end of the existing file (after line 2830).

---

## Task 1: Add CSS Styles

**Files:**
- Modify: `src/App.css` (append after line 2830)

**Interfaces:**
- Consumes: Nothing
- Produces: CSS classes `.loading-screen`, `.loading-liquid`, `.loading-content`, `.loading-logo`, `.loading-logo-img`, `.loading-bar-container`, `.loading-bar-fill`; keyframes `liquidFlow`, `logoSwapBlack`, `logoSwapWhite`, `fadeOut`

- [ ] **Step 1: Read the end of App.css to verify insertion point**

Read `src/App.css` starting at line 2825 to confirm the exact end-of-file content.

- [ ] **Step 2: Append loading screen CSS**

Append the following CSS at the end of `src/App.css`:

```css
/* ── LOADING SCREEN ── */
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #0b090a;
  opacity: 1;
  transition: opacity 300ms ease-in-out;
}

.loading-screen.fade-out {
  opacity: 0;
}

.loading-liquid {
  position: absolute;
  inset: 0;
  background: linear-gradient(270deg, #e5383b, #161a1d, #d3d3d3);
  background-size: 500% 500%;
  animation: liquidFlow 10s ease-in-out infinite;
  filter: blur(20px);
  z-index: 0;
}

@keyframes liquidFlow {
  0% {
    background-position: 0% 50%;
    transform: scale(1);
  }
  25% {
    background-position: 100% 25%;
    transform: scale(1.03);
  }
  50% {
    background-position: 100% 50%;
    transform: scale(1.01);
  }
  75% {
    background-position: 0% 75%;
    transform: scale(1.02);
  }
  100% {
    background-position: 0% 50%;
    transform: scale(1);
  }
}

.loading-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 44px;
}

.loading-logo {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.35);
  box-shadow:
    0 0 40px rgba(229, 56, 59, 0.20),
    inset 0 0 30px rgba(0, 0, 0, 0.40);
  backdrop-filter: blur(4px);
}

.loading-logo-img {
  max-width: 70%;
  max-height: 70%;
  object-fit: contain;
  position: absolute;
  inset: 0;
  margin: auto;
  opacity: 0;
  transition: opacity 0.6s ease-in-out;
}

.loading-logo img:first-child {
  animation: logoSwapBlack 5s infinite;
}

.loading-logo img:last-child {
  animation: logoSwapWhite 5s infinite;
}

@keyframes logoSwapBlack {
  0%, 45% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

@keyframes logoSwapWhite {
  0%, 50% { opacity: 0; }
  55%, 100% { opacity: 1; }
}

.loading-bar-container {
  width: 320px;
  height: 8px;
  max-width: 80vw;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  z-index: 2;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
}

.loading-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #e5383b, #ff6b6b);
  border-radius: 4px;
  transition: width 0.05s linear;
  box-shadow: 0 0 12px rgba(229, 56, 59, 0.5);
}
```

- [ ] **Step 3: Verify CSS syntax**

Run: `npx prettier --check src/App.css` (if prettier is available) or visually inspect for syntax errors.

- [ ] **Step 4: Commit CSS changes**

```bash
git add src/App.css
git commit -m "style: add loading screen CSS (gradient, liquid flow, logo swap, progress bar)"
```

---

## Task 2: Create LoadingScreen Component

**Files:**
- Create: `src/components/LoadingScreen.jsx`

**Interfaces:**
- Consumes: Props `{ onFinish: () => void }`
- Produces: A `LoadingScreen` React component with `progress` state (0–100), `fading` state (boolean), and a 6-second timer

- [ ] **Step 1: Create the components directory**

```bash
mkdir -p src/components
```

- [ ] **Step 2: Write the LoadingScreen component**

Create `src/components/LoadingScreen.jsx`:

```jsx
import { useState, useEffect } from 'react';
import blackLogo from '../assets/1.png';
import whiteLogo from '../assets/12.png';

export default function LoadingScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const duration = 6000; // 6 seconds (within 5-7s range)
    const intervalMs = 50;
    const step = (100 * intervalMs) / duration;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          // Hold at 100% briefly, then fade out
          setTimeout(() => setFading(true), 200);
          setTimeout(() => onFinish(), 500); // 200ms hold + 300ms fade
          return 100;
        }
        return Math.round(next);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className={`loading-screen ${fading ? 'fade-out' : ''}`}>
      <div className="loading-liquid" />
      <div className="loading-content">
        <div className="loading-logo">
          <img src={blackLogo} alt="OpenLauncher" className="loading-logo-img" />
          <img src={whiteLogo} alt="OpenLauncher" className="loading-logo-img" />
        </div>
        <div className="loading-bar-container">
          <div
            className="loading-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify file structure**

Run: `ls -la src/components/LoadingScreen.jsx`

- [ ] **Step 4: Verify component syntax (Vite can parse it)**

Run: `npx vite build --dry-run 2>&1 | head -20` or check that Vite can resolve the imports.

- [ ] **Step 5: Commit component**

```bash
git add src/components/LoadingScreen.jsx
git commit -m "feat: add LoadingScreen component with gradient, logo swap, and progress bar"
```

---

## Task 3: Integrate LoadingScreen into main.jsx

**Files:**
- Modify: `src/main.jsx` (lines 1-13)

**Interfaces:**
- Consumes: `LoadingScreen` component from `src/components/LoadingScreen.jsx`
- Produces: A `Root` wrapper component that conditionally renders `<App />` or `<LoadingScreen>`

- [ ] **Step 1: Read current main.jsx**

Read `src/main.jsx` to verify the exact current content (should be the 13-line file we saw).

- [ ] **Step 2: Replace main.jsx with the loading-gated version**

```jsx
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import { I18nProvider } from './context/I18nContext.jsx'

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

- [ ] **Step 3: Start dev server and verify**

Run: `npm run dev` (this runs Vite dev server + Electron)

Observe:
1. Loading screen appears with flowing gradient, blurred liquid effect
2. Logo alternates between black (1.png) and white (12.png) every 2.5s
3. Progress bar fills from 0→100% over 6 seconds
4. After 6s, loading screen fades out (300ms opacity transition)
5. Main app renders after fade completes

- [ ] **Step 4: Stop dev server**

Ctrl+C to stop once verified.

- [ ] **Step 5: Commit integration**

```bash
git add src/main.jsx
git commit -m "feat: gate App behind LoadingScreen on startup"
```

---

## Final Verification

- [ ] Run `npm run dev` and confirm loading screen → app transition works
- [ ] Verify no console errors in renderer or main process
- [ ] Verify logo alternation is visible (black then white)
- [ ] Verify gradient flows continuously
- [ ] Verify progress bar completes at exactly 6s
- [ ] Verify fade-out is smooth (300ms opacity transition)
