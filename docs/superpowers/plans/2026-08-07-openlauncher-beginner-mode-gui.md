# Beginner Mode GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the `CentralCard` component (already created) and beginner mode CSS (already added) into `App.jsx` so that new users with no profiles see a simple, minimalist, expandable card with preset shortcuts for offline name + vanilla Minecraft version.

**Architecture:** Add `beginnerMode` boolean state to `App.jsx`, triggered when `hydrateState` finds zero profiles. When active, render `<CentralCard>` inside a `.beginner-mode` wrapper instead of the full `.app-layout`. The `handleBeginnerPlay` function creates a local profile + local account, then defers to the existing `handlePlay` via a `useEffect` + ref pattern to avoid stale-closure issues. The "Show Full Launcher" button exits beginner mode one-way.

**Tech Stack:** React 19, Vite, Electron 43, plain CSS (PostCSS nesting), no test framework

## Global Constraints

- React 19 — hooks only, no external state libs
- Vite bundler — asset imports use `import img from '../assets/x.png'`
- No test framework — verification is manual via `npm run dev`
- CSS: plain CSS with CSS custom properties, matching existing `App.css` patterns
- All CSS variables already defined in `App.css` `:root` (confirmed: `--text-primary`, `--text-muted`, `--border`, `--accent`, `--accent-border`, `--radius-sm`, `--radius-md`, `--font-display`, `--font-mono`, `--font-body`, `--page-gutter`)

---

## Current State

- ✅ `LoadingScreen.jsx` — Created and integrated into `main.jsx`
- ✅ Beginner mode CSS — Appended to `App.css` (lines 2960–3135)
- ✅ `CentralCard.jsx` — Created with all component logic (props, presets, form)
- ❌ `App.jsx` — NOT wired up: no `beginnerMode` state, no CentralCard import, no conditional rendering, no `handleBeginnerPlay`

## Key Codebase Facts

- `versionCatalog` entries have: `id`, `label`, `type` ('vanilla'|'snapshot'|'fabric'|'forge'), `mcVer`, `releaseTime`
- `handleSaveProfile({ name, localName, version, ram, jvmArguments })` — when `id` is omitted/undefined, creates a new profile and calls `setActiveProfileId(newProfileId)`
- `handlePlay` checks `activeProfile` and `account.loggedIn` — both must be set before calling
- `createOfflineSession(name)` — defined at `App.jsx:15`, returns `{ name, username: name, userType: 'legacy' }`
- Account hydration effect (line 1105) is async and depends on `activeProfileId` — may race with direct `setAccount` calls
- Render structure: `toast-stack` → `titlebar` → `app-layout` (sidebar + main-content) → modals
- `hydrateState` at line 977: `incomingProfiles.length === 0` is the trigger point for beginner mode

---

### Task 1: Add state and imports for beginner mode

**Files:**
- Modify: `src/App.jsx:1-13` (add import)
- Modify: `src/App.jsx:743-746` (add state after `appVersion`)

**Interfaces:**
- Consumes: `CentralCard` from `./components/CentralCard.jsx`
- Produces: `beginnerMode`, `beginnerLocalName`, `beginnerSelectedVersion`, `beginnerPlayIntent` state; `handlePlayRef` ref; `vanillaVersions` derived value; `handleBeginnerPlay` function

- [ ] **Step 1: Add CentralCard import**

After line 12 (`import logoIcon from '/icon.webp';`), add:

```jsx
import CentralCard from './components/CentralCard.jsx';
```

- [ ] **Step 2: Add beginner mode state variables**

After line 743 (`const [appVersion, setAppVersion] = useState('');`), add:

```jsx
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [beginnerLocalName, setBeginnerLocalName] = useState('');
  const [beginnerSelectedVersion, setBeginnerSelectedVersion] = useState('');
  const [beginnerPlayIntent, setBeginnerPlayIntent] = useState(false);
```

- [ ] **Step 3: Add handlePlay ref**

After line 756 (`});` — end of `stateRef` declaration), add:

```jsx
  const handlePlayRef = useRef(null);
  handlePlayRef.current = handlePlay;
```

> **Note:** `handlePlay` is defined at line 1216, which is after this declaration. This is fine because the ref assignment happens at render time (after the component body executes top-to-bottom), and `handlePlayRef.current` is always current when the useEffect fires.

- [ ] **Step 4: Add vanillaVersions derived value**

After line 768 (`const activeVersion = ...` — existing derived value), add:

```jsx
  const vanillaVersions = versionCatalog.filter((v) => v.type === 'vanilla');
```

---

### Task 2: Add handleBeginnerPlay and play-trigger useEffect

**Files:**
- Modify: `src/App.jsx` (insert before the `return` statement at line 1780)

**Interfaces:**
- Consumes: `handleSaveProfile`, `setAccount`, `createOfflineSession`, `handlePlayRef`, `beginnerLocalName`, `beginnerSelectedVersion`
- Produces: `handleBeginnerPlay()` function, play-trigger useEffect

- [ ] **Step 1: Add handleBeginnerPlay function**

Insert before `return (`:

```jsx
  const handleBeginnerPlay = () => {
    const name = beginnerLocalName.trim();
    if (!name || !beginnerSelectedVersion) return;

    handleSaveProfile({
      name,
      localName: name,
      version: beginnerSelectedVersion,
      ram: 4,
      jvmArguments: '',
    });
    setAccount({
      name,
      loggedIn: true,
      profileKey: 'default',
      kind: 'local',
      session: createOfflineSession(name),
    });
    setBeginnerPlayIntent(true);
  };
```

> **Why no `id`?** `handleSaveProfile` checks `id == null` to distinguish new vs edit. Omitting `id` makes it `undefined`, which satisfies `undefined == null`, so `handleSaveProfile` generates a `Date.now()` ID and calls `setActiveProfileId(newProfileId)`.

- [ ] **Step 2: Add play-trigger useEffect**

Insert after `handleBeginnerPlay`:

```jsx
  // Auto-trigger handlePlay after beginner profile + account state settles
  useEffect(() => {
    if (!beginnerPlayIntent) return;
    if (!account.loggedIn || !activeProfile) return;

    setBeginnerPlayIntent(false);
    setBeginnerMode(false);
    handlePlayRef.current?.();
  }, [beginnerPlayIntent, account.loggedIn, activeProfile?.id, activeProfileId]);
```

> **Why useEffect + ref?** `handlePlay` reads `activeProfile`, `account`, and `activeVersion` from the component closure. After calling `handleSaveProfile` and `setAccount`, those state values haven't updated yet in the current execution context. The useEffect fires after the next render, when `account.loggedIn` is true and `activeProfile` is the newly created profile. `handlePlayRef` ensures we always call the latest `handlePlay` (which reads current state, not stale closure).

---

### Task 3: Set beginnerMode in hydrateState

**Files:**
- Modify: `src/App.jsx:1037-1038`

**Interfaces:**
- Consumes: `setBeginnerMode`, `incomingProfiles`
- Produces: `beginnerMode = true` on first launch with no saved profiles

- [ ] **Step 1: Add beginner mode trigger in hydrateState**

At line 1038, the code already checks `if (incomingProfiles.length === 0)`. Add `setBeginnerMode(true)` inside this block. The current code at lines 1038–1066 persists state with default profiles. Insert right after the `if` line:

```jsx
      if (incomingProfiles.length === 0) {
        setBeginnerMode(true);
        persistState({
          profiles: nextProfiles,
          mods: savedMods,
          logs: [],
          versions: state.versions && Array.isArray(state.versions) ? state.versions : [],
          installTargets: state.installTargets && typeof state.installTargets === 'object'
            ? state.installTargets
            : installTargets,
          settings: state.settings && typeof state.settings === 'object'
            ? {
              javaPath: typeof state.settings.javaPath === 'string' ? state.settings.javaPath : '',
              keepOpen: typeof state.settings.keepOpen === 'boolean' ? state.settings.keepOpen : false,
              showConsole: typeof state.settings.showConsole === 'boolean' ? state.settings.showConsole : true,
              autoUpdate: typeof state.settings.autoUpdate === 'boolean' ? state.settings.autoUpdate : true,
              showSnapshots: typeof state.settings.showSnapshots === 'boolean' ? state.settings.showSnapshots : false,
              language: typeof state.settings.language === 'string' && state.settings.language.trim()
                ? state.settings.language.trim()
                : language,
            }
            : {
              javaPath: '',
              keepOpen: false,
              showConsole: true,
              autoUpdate: true,
              showSnapshots: false,
              language,
            },
        });
      } else {
```

> **Why this works:** On first launch, `incomingProfiles.length === 0`. The code creates `defaultProfile` (with `localName: 'Steve'`) and persists it. `setBeginnerMode(true)` is called in the same state batch, so on the next render, `beginnerMode` is `true` and `profiles` has the default profile (but the user hasn't customized it). The CentralCard renders instead of the full GUI.

---

### Task 4: Add conditional rendering in the return statement

**Files:**
- Modify: `src/App.jsx:1811-1813` (opening) and `src/App.jsx:2291` (closing)

**Interfaces:**
- Consumes: `beginnerMode`, `beginnerLocalName`, `beginnerSelectedVersion`, `vanillaVersions`, `handleBeginnerPlay`, `appVersion`, `setBeginnerMode`
- Produces: Conditional rendering of CentralCard vs full app-layout

- [ ] **Step 1: Replace the opening `<div className="app-layout">` with conditional**

Replace lines 1812–1813:
```jsx
      {/* Main layout */}
      <div className="app-layout">
        {/* Sidebar */}
```
with:
```jsx
      {/* Main content */}
      {beginnerMode ? (
        <div className="beginner-mode">
          <CentralCard
            localName={beginnerLocalName}
            selectedVanillaVersion={beginnerSelectedVersion}
            vanillaVersions={vanillaVersions}
            onNameChange={setBeginnerLocalName}
            onVersionChange={setBeginnerSelectedVersion}
            onPlay={handleBeginnerPlay}
            onExpand={() => setBeginnerMode(false)}
            appVersion={appVersion}
          />
        </div>
      ) : (
        <div className="app-layout">
        {/* Sidebar */}
```

- [ ] **Step 2: Close the conditional after the app-layout div**

Replace line 2291:
```jsx
      </div>
```
(the one before `/* Modals */`) with:
```jsx
      </div>
      )}
```

> **Important:** The `</div>` at line 2291 closes the `<div className="app-layout">`. After this, we need to close the ternary expression `}` and the JSX expression `)`. The result should be:
> ```
>       </main>
>     </div>      {/* closes .app-layout */}
>     )}          {/* closes the ternary )}
>
>     {/* Modals */}
> ```

---

### Task 5: Verify build and manual testing

**Files:**
- None modified

**Interfaces:**
- Consumes: Running app via `npm run dev`
- Produces: Working beginner mode

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify first-launch (no profiles) shows CentralCard**

Clear app data or delete saved state, restart. Verify:
1. Titlebar still visible with logo + app name + version
2. Full GUI (sidebar, main-content) is NOT visible
3. Grays out behind CentralCard
4. CentralCard renders with: "OpenLauncher" heading, name input, version dropdown, PLAY button (disabled), preset buttons, "Show Full Launcher →" link

- [ ] **Step 3: Verify form interaction**

1. Type a name in the input → Play button should enable when both name and version are set
2. Select a vanilla version from dropdown → Play button enables

- [ ] **Step 4: Verify preset buttons**

1. Click "Steve + 1.20.1" → name input fills with "Steve", version dropdown selects 1.20.1
2. Click "Alex + 1.21" → name input fills with "Alex", version dropdown selects 1.21
3. Click "Herobrine + 1.20.4" → name input fills with "Herobrine", version dropdown selects 1.20.4

- [ ] **Step 5: Verify Expand button**

1. Click "Show Full Launcher →" → full GUI renders (sidebar, main content, bottom bar)
2. Verify all existing functionality works: profiles, tabs, play button, settings, etc.

- [ ] **Step 6: Verify version loading state**

1. If version catalog is empty, dropdown shows "Loading versions..." and is disabled
2. Play button stays disabled

- [ ] **Step 7: Stop dev server**

Ctrl+C

- [ ] **Step 8: Commit changes**

```bash
git add src/App.jsx
git commit -m "feat: wire up beginner mode CentralCard with conditional rendering and play trigger"
```

---

## Render Structure After Changes

```jsx
return (
  <>
    <div className="toast-stack">...</div>
    <div className="titlebar">...</div>

    {beginnerMode ? (
      <div className="beginner-mode">
        <CentralCard ... />
      </div>
    ) : (
      <div className="app-layout">
        <aside className="sidebar">...</aside>
        <main className="main-content">...</main>
        <div className="bottom-bar">...</div>
      </div>
    )}

    {/* Modals — always visible */}
    {profileEditor && <ProfileModal .../>}
    {modal && <InstallModal .../>}
    {/* ... */}
  </>
);
```
