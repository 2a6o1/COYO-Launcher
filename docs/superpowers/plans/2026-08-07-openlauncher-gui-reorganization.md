# GUI Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beginner-mode central card to OpenLauncher that lets new users quickly enter an offline name and select a vanilla Minecraft version, with quick preset buttons ("zapato") and an expand button to reveal the full existing GUI.

**Architecture:** Add a `beginnerMode` boolean state to `App.jsx` that, when `true` (no profiles exist for the user), renders a new `CentralCard` component instead of the full `app-layout`. The card contains a name input, vanilla version dropdown, PLAY button, 3 quick preset buttons, and a "Show Full Launcher" expand link. After Play is clicked, a profile is created, an offline account is set up, the game launches, and beginner mode auto-exits to show the full GUI.

**Tech Stack:** React 19 (hooks: useState, useEffect), Vite, plain CSS (no preprocessors), Electron IPC bridge (`window.launcher`)

## Global Constraints

- React 19 — use useState/useEffect, no external state libraries
- Vite bundler — asset imports use `import img from '../assets/x.png'` syntax
- No test framework — verification is manual via `npm run dev` and `npx vite build`
- CSS: plain CSS with CSS custom properties (`--variable`), matching existing `App.css` patterns (section comments, glassmorphism, `--accent`/`--border`/`--text-*` tokens)
- `beginnerMode` defaults to `true` when `incomingProfiles.length === 0` after state hydration
- Duration: fixed behavior (no timer) — beginner mode exits after profile creation + game launch
- Assets: `src/assets/1.png` (black logo, exist), `src/assets/12.png` (white logo, exist)
- Version catalog entries: `{ id: 'vanilla-1.20.1', label: 'Vanilla - 1.20.1', type: 'vanilla', mcVer: '1.20.1', releaseTime: '...' }`
- Vanilla versions filtered via `versionCatalog.filter(v => v?.type === 'vanilla')`
- Presets: Steve + 1.20.1, Alex + 1.21, Herobrine + 1.20.4

---

## File Structure

```
src/
├── components/
│   ├── LoadingScreen.jsx   ← EXISTS (from loading screen feature)
│   └── CentralCard.jsx     ← CREATE (new file)
├── App.jsx                  ← MODIFY (add beginnerMode state + conditional render + handleBeginnerPlay)
├── App.css                  ← MODIFY (append beginner mode CSS)
├── assets/
│   ├── 1.png                ← EXISTS (black logo)
│   └── 12.png               ← EXISTS (white logo)
```

### Task Decomposition

1. **Task 1: Add beginner mode CSS** — Append CSS classes to `src/App.css` for the beginner card, form, presets, and expand button. Self-contained, verifiable via build.
2. **Task 2: Create CentralCard component** — Create `src/components/CentralCard.jsx` with the UI and preset logic. Self-contained, depends only on CSS from Task 1.
3. **Task 3: Integrate into App.jsx** — Add `beginnerMode` state, conditional rendering, and `handleBeginnerPlay` function. Depends on Task 1 (CSS) and Task 2 (component).

---

## Task 1: Add Beginner Mode CSS

**Files:**
- Modify: `src/App.css` (append after line 2830 — end of file)

**Interfaces:**
- Consumes: Nothing
- Produces: CSS classes `.beginner-mode`, `.beginner-card`, `.beginner-header`, `.beginner-version`, `.beginner-form`, `.beginner-input`, `.beginner-select`, `.beginner-play-btn`, `.beginner-presets`, `.beginner-expand`; uses existing `fadeIn` keyframe

- [ ] **Step 1: Read end of App.css to confirm insertion point**

Read `src/App.css` starting at line 2825 to verify the last lines.

- [ ] **Step 2: Append beginner mode CSS**

Append the following CSS at the end of `src/App.css`:

```css
/* ── BEGINNER MODE ── */
.beginner-mode {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--page-gutter);
  animation: fadeIn 0.3s ease-out;
}

.beginner-card {
  background: linear-gradient(180deg, rgba(22, 26, 35, 0.96), rgba(17, 19, 23, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 42px 48px;
  width: min(420px, 90vw);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
}

.beginner-header {
  text-align: center;
  margin-bottom: 32px;
}

.beginner-header h1 {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.beginner-version {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
}

.beginner-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 28px;
}

.beginner-input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}

.beginner-input:focus {
  border-color: var(--accent-border);
  background: rgba(255, 255, 255, 0.06);
}

.beginner-input::placeholder {
  color: var(--text-muted);
}

.beginner-select {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a4a4a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.beginner-select:focus {
  border-color: var(--accent-border);
}

.beginner-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.beginner-play-btn {
  width: 100%;
  padding: 14px;
  margin-bottom: 28px;
  background: linear-gradient(180deg, rgba(186, 24, 27, 0.14), rgba(186, 24, 27, 0.08));
  border: 1.5px solid var(--accent);
  border-radius: 16px;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s, border-color 0.2s;
}

.beginner-play-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, rgba(186, 24, 27, 0.22), rgba(186, 24, 27, 0.12));
  box-shadow: 0 8px 24px rgba(186, 24, 27, 0.24);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.beginner-play-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.beginner-play-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.beginner-presets {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.beginner-presets button {
  flex: 1;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s, color 0.16s, transform 0.16s;
  text-align: center;
}

.beginner-presets button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent-border);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.beginner-expand {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.16s, border-color 0.16s;
  border-radius: var(--radius-sm);
}

.beginner-expand:hover {
  color: var(--text-primary);
  border-color: var(--border);
}
```

- [ ] **Step 3: Verify CSS syntax**

Run: `npx prettier --check src/App.css` — confirm no syntax errors

- [ ] **Step 4: Commit CSS**

```bash
git add src/App.css
git commit -m "style: add beginner mode CSS (card, form, presets, expand button)"
```

---

## Task 2: Create CentralCard Component

**Files:**
- Create: `src/components/CentralCard.jsx`

**Interfaces:**
- Consumes: CSS classes from Task 1 (`.beginner-card`, `.beginner-input`, `.beginner-select`, `.beginner-play-btn`, `.beginner-presets`, `.beginner-expand`, `.beginner-header`, `.beginner-form`)
- Produces: A `CentralCard` React component with props `{ localName, selectedVanillaVersion, vanillaVersions, onNameChange, onVersionChange, onPlay, onExpand, appVersion }`

- [ ] **Step 1: Create the component file**

Create `src/components/CentralCard.jsx` with exactly this content:

```jsx
export default function CentralCard({
  localName,
  selectedVanillaVersion,
  vanillaVersions,
  onNameChange,
  onVersionChange,
  onPlay,
  onExpand,
  appVersion = '',
}) {
  // Resolve a Minecraft version string (e.g. "1.20.1") to its catalog entry ID
  const getVersionId = (mcVer) => {
    const found = vanillaVersions.find(v => v?.mcVer === mcVer);
    return found ? found.id : '';
  };

  // Apply a preset: fill name + resolve version
  const applyPreset = (name, mcVer) => {
    onNameChange(name);
    const versionId = getVersionId(mcVer);
    if (versionId) {
      onVersionChange(versionId);
    }
  };

  const canPlay = Boolean(localName && localName.trim()) && Boolean(selectedVanillaVersion);

  return (
    <div className="beginner-card">
      <div className="beginner-header">
        <h1>Coyo Launcher</h1>
        <span className="beginner-version">{appVersion || '...'}</span>
      </div>

      <div className="beginner-form">
        <input
          type="text"
          className="beginner-input"
          placeholder="Enter your name"
          value={localName}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={32}
          autoFocus
        />
        <select
          className="beginner-select"
          value={selectedVanillaVersion}
          onChange={(e) => onVersionChange(e.target.value)}
          disabled={vanillaVersions.length === 0}
        >
          <option value="">
            {vanillaVersions.length === 0 ? 'Loading versions...' : 'Select Minecraft version'}
          </option>
          {vanillaVersions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <button
        className="beginner-play-btn"
        onClick={onPlay}
        disabled={!canPlay}
      >
        PLAY
      </button>

      <div className="beginner-presets">
        <button type="button" onClick={() => applyPreset('Steve', '1.20.1')}>Steve + 1.20.1</button>
        <button type="button" onClick={() => applyPreset('Alex', '1.21')}>Alex + 1.21</button>
        <button type="button" onClick={() => applyPreset('Herobrine', '1.20.4')}>Herobrine + 1.20.4</button>
      </div>

      <button className="beginner-expand" type="button" onClick={onExpand}>
        Show Full Launcher →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify component builds**

Run: `npx vite build` — confirm no import/syntax errors

- [ ] **Step 3: Commit component**

```bash
git add src/components/CentralCard.jsx
git commit -m "feat: add CentralCard component for beginner mode"
```

---

## Task 3: Integrate Beginner Mode into App.jsx

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `CentralCard` from Task 2, CSS classes from Task 1, existing App.jsx functions (`handleSaveProfile`, `handlePlay`, `createOfflineSession`)
- Produces: Beginner mode integration in App.jsx with `beginnerMode` state, conditional rendering, and `handleBeginnerPlay`

- [ ] **Step 1: Add imports and state**

At the top of `App.jsx`, change the import line to also import `CentralCard`:

```jsx
// Line 2 (existing):
import './App.css';

// Add after line 2:
import CentralCard from './components/CentralCard.jsx';
```

Then add three new state variables. Find the existing state declarations (around line 714+) and add:

```jsx
// Add near the other useState declarations in App():
const [beginnerMode, setBeginnerMode] = useState(false);
const [localName, setLocalName] = useState('');
const [selectedVanillaVersion, setSelectedVanillaVersion] = useState('');
```

- [ ] **Step 2: Add vanillaVersions computed value**

Find the existing computed values section (near line 758) and add:

```jsx
// Add after the activeProfile computation:
const vanillaVersions = versionCatalog.filter((v) => v?.type === 'vanilla');
```

- [ ] **Step 3: Set beginnerMode when no profiles exist**

In the `hydrateState` function, find where `setProfiles(nextProfiles)` is called (line ~993) and add immediately after:

```jsx
// After: setProfiles(nextProfiles);
if (incomingProfiles.length === 0) {
  setBeginnerMode(true);
}
```

- [ ] **Step 4: Add handleBeginnerPlay function**

Find the `handlePlay` function definition (around line 1216) and add `handleBeginnerPlay` after it:

```jsx
const handleBeginnerPlay = async () => {
  const trimmedName = String(localName || '').trim();
  if (!trimmedName || !selectedVanillaVersion) return;

  const newProfile = {
    id: Date.now(),
    name: trimmedName,
    localName: trimmedName,
    version: selectedVanillaVersion,
    ram: 4,
    jvmArguments: '',
    active: false,
  };

  handleSaveProfile(newProfile);

  setAccount({
    name: trimmedName,
    loggedIn: true,
    profileKey: String(newProfile.id),
    kind: 'local',
    session: createOfflineSession(trimmedName),
  });

  // Wait for React to re-render with the new profile
  await new Promise((resolve) => setTimeout(resolve, 500));

  await handlePlay();

  // Exit beginner mode to show the full GUI
  setBeginnerMode(false);
};
```

- [ ] **Step 5: Add conditional rendering**

In the `return` statement of `App()`, find where the app-layout div begins (around line 1813) and wrap it with the beginner mode conditional. The current structure is:

```jsx
// After the titlebar div (line ~1810), replace:
// <div className="app-layout"> ... </div>
// With:
{beginnerMode ? (
  <div className="beginner-mode">
    <CentralCard
      localName={localName}
      selectedVanillaVersion={selectedVanillaVersion}
      vanillaVersions={vanillaVersions}
      onNameChange={setLocalName}
      onVersionChange={setSelectedVanillaVersion}
      onPlay={handleBeginnerPlay}
      onExpand={() => setBeginnerMode(false)}
      appVersion={appVersion}
    />
  </div>
) : (
  <div className="app-layout">
    {/* ... existing sidebar + main content ... */}
  </div>
)}
```

The exact insertion point is after the `</div>` that closes the titlebar (line 1810) and before the `{/* Main layout */}` comment (line 1812).

- [ ] **Step 6: Verify build**

Run: `npx vite build` — confirm the build succeeds with no errors

- [ ] **Step 7: Commit integration**

```bash
git add src/App.jsx
git commit -m "feat: add beginner mode with CentralCard for new users"
```

---

## Final Verification

- [ ] Run `npx vite build` — no errors
- [ ] Run `npm run dev` — loading screen appears, then beginner card for new users (no profiles)
- [ ] Verify name input field appears and accepts text
- [ ] Verify version dropdown shows vanilla versions from catalog
- [ ] Verify preset buttons fill name + version
- [ ] Verify PLAY button is disabled until both fields are filled
- [ ] Verify "Show Full Launcher" expands to full GUI
- [ ] Verify full GUI works unchanged (profiles, tabs, play button, etc.)
