# OpenLauncher GUI Reorganization Design Spec

**Date**: 2026-08-07
**Project**: OpenLauncher
**Topic**: GUI reorganization for new users — beginner-mode central card with expandable full GUI
**Status**: Awaiting user review

---

## 1. Purpose

Reorganize the OpenLauncher GUI into an interactive, dynamic layout that starts simple and minimalist for new users, with a central card containing the essential elements needed to launch Minecraft. The card includes quick preset shortcuts ("zapato") for offline name + vanilla Minecraft version combinations. A toggle button expands to reveal the full existing GUI with all sections as currently designed.

## 2. Context

### 2.1 Project Stack
- Electron 43 + React 19 + Vite
- Entry: `src/main.jsx` → `src/App.jsx` (single-page app, ~2350 lines)
- `src/App.css` (2830+ lines) — CSS with custom properties, PostCSS nesting
- Assets: `src/assets/1.png` (black logo), `src/assets/12.png` (white logo)

### 2.2 Current GUI Composition (unchanged by this spec)
- **Titlebar** (`.titlebar`, 42px): logo + app name + version, window controls (minimize/maximize/close)
- **Sidebar** (`.sidebar`): profiles list, navigation (news/console/mods), account area
- **Main content** (`.main-content`): update banner, action bar, tab panels, bottom bar
- **Modals**: profile editor, install, settings, about, login loading
- **Theme**: Dark with CSS tokens — `--bg-void: #0b090a`, `--accent: #ba181b`, `--danger: #e5383b`, `--text-secondary: #d3d3d3`

### 2.3 Loading Screen (already implemented)
A loading screen (`LoadingScreen.jsx`) was added as a separate feature and gates the initial render for 6 seconds. This GUI reorganization is independent — it modifies what renders *after* the loading screen completes.

## 3. Requirements

| ID | Requirement | Source |
|---|---|---|
| R1 | Reorganize GUI sections interactively and dynamically for new users | User request |
| R2 | Start simple and minimalist for new users | User request |
| R3 | Central card with basic elements: offline name + vanilla Minecraft version | User request |
| R4 | Quick preset shortcuts ("zapato") for name + version combinations | User request (clarified) |
| R5 | Expandable to show full GUI with all existing sections | User request |
| R6 | Full GUI works exactly as currently designed when expanded | User request |
| R7 | Beginner mode triggers for new users (no existing profiles) | Design decision |
| R8 | Reuse existing CSS patterns and design tokens | Architecture |

## 4. Design

### 4.1 Approach: Conditional rendering with App-level state

Add a `beginnerMode` boolean state to `App.jsx`. When `true` (and no profiles exist), render only a `CentralCard` component. When `false`, render the full existing GUI unchanged.

This is the lowest-risk approach — the existing 2350-line `App.jsx` render logic is untouched except for one conditional branch.

### 4.2 State Management

New state in `App.jsx`:

```jsx
const [beginnerMode, setBeginnerMode] = useState(false);
const [localName, setLocalName] = useState('');
const [selectedVanillaVersion, setSelectedVanillaVersion] = useState('');
```

**Initialization logic** (in the `hydrateState` effect):
```jsx
// After state loads, determine if user is new
if (incomingProfiles.length === 0) {
  setBeginnerMode(true);
}
```

**Auto-exit beginner mode** after first successful profile creation + game launch.

### 4.3 Render Structure

```jsx
return (
  <>
    {/* Toast stack — always visible */}
    <div className="toast-stack">...</div>

    {/* Titlebar — always visible */}
    <div className="titlebar">...</div>

    {/* Conditional main content */}
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
        />
      </div>
    ) : (
      <div className="app-layout">
        {/* ... existing sidebar + main content + bottom bar ... */}
      </div>
    )}

    {/* Modals — always visible */}
    {profileEditor && <ProfileModal .../>}
    {modal && <InstallModal .../>}
    {/* ... */}
  </>
);
```

### 4.4 CentralCard Component (new: `src/components/CentralCard.jsx`)

**Props:**
- `localName: string` — current name input value
- `selectedVanillaVersion: string` — current version selection
- `vanillaVersions: Array<{id, label, mcVer}>` — filtered from versionCatalog
- `onNameChange: (name: string) => void`
- `onVersionChange: (version: string) => void`
- `onPlay: () => void`
- `onExpand: () => void`

**Internal handlers:**
- `getVersionId(mcVer)` — helper that resolves a version string (e.g. "1.20.1") to the matching `id` from the `vanillaVersions` prop. Returns empty string if not found.
- `applyPreset(name, mcVer)` — calls `getVersionId(mcVer)` to resolve the version ID, then calls `onNameChange(name)` and `onVersionChange(versionId)` to fill both fields

**JSX:**
```jsx
<div className="beginner-card">
  <div className="beginner-header">
    <h1>OpenLauncher</h1>
    <span className="beginner-version">{appVersion || '...'}</span>
  </div>

  <div className="beginner-form">
    <input
      type="text"
      className="beginner-input"
      placeholder="Enter your name"
      value={localName}
      onChange={e => onNameChange(e.target.value)}
      maxLength={32}
      autoFocus
    />
    <select
      className="beginner-select"
      value={selectedVanillaVersion}
      onChange={e => onVersionChange(e.target.value)}
    >
      <option value="">Select Minecraft version</option>
      {vanillaVersions.map(v => (
        <option key={v.id} value={v.id}>{v.label}</option>
      ))}
    </select>
  </div>

  <button
    className="beginner-play-btn"
    onClick={onPlay}
    disabled={!localName || !selectedVanillaVersion}
  >
    PLAY
  </button>

  <div className="beginner-presets">
    <button onClick={() => applyPreset('Steve', '1.20.1')}>Steve + 1.20.1</button>
    <button onClick={() => applyPreset('Alex', '1.21')}>Alex + 1.21</button>
    <button onClick={() => applyPreset('Herobrine', '1.20.4')}>Herobrine + 1.20.4</button>
  </div>

  <button className="beginner-expand" onClick={onExpand}>
    Show Full Launcher →
  </button>
</div>
```

### 4.5 Quick Preset Buttons ("Zapato")

Three preset buttons below the Play button:
- "Steve + 1.20.1"
- "Alex + 1.21"
- "Herobrine + 1.20.4"

Clicking a preset calls `applyPreset(name, mcVer)` which internally calls `getVersionId(mcVer)` to resolve the version ID, then:
1. Calls `onNameChange(name)` to set the name field
2. Calls `onVersionChange(versionId)` to set the version dropdown

The version ID lookup resolves the version label (e.g. "1.20.1") to the actual `versionCatalog` entry ID. If the version isn't in the catalog yet (still loading), the dropdown stays disabled and the user is directed to expand to full GUI.

### 4.6 Play Button Behavior in Beginner Mode

`handleBeginnerPlay`:
```jsx
const handleBeginnerPlay = async () => {
  if (!localName || !selectedVanillaVersion) return;

  // Create a default profile with the entered name and selected version
  const newProfile = {
    id: Date.now(),
    name: localName,
    localName: localName,
    version: selectedVanillaVersion,
    ram: 4,
    jvmArguments: '',
    active: true,
  };

  // Save the profile (reuses existing handleSaveProfile logic)
  handleSaveProfile(newProfile);

  // Launch the game (reuses existing handlePlay logic)
  await handlePlay();

  // Exit beginner mode after successful launch
  setBeginnerMode(false);
};
```

### 4.7 Expand Button

"Show Full Launcher →" link at the bottom of the card. Clicking calls `onExpand` which sets `beginnerMode = false`. This is one-way — once expanded, the full GUI remains for the session. The titlebar stays visible throughout.

### 4.8 Animations

- **Card entrance**: Reuses existing `@keyframes fadeIn` from `App.css` (line 2001) — fade + slight scale up
- **Expand transition**: `.beginner-mode` fades out as `.app-layout` fades in (staggered with 150ms delay)
- **Play button**: Same styles as existing `.play-btn` (accent gradient, hover scale, active press)
- **Preset buttons**: Similar to `.btn-ghost` styling with accent border on hover
- **Version loading**: Dropdown shows "Loading..." while `versionCatalog` is being fetched

### 4.9 CSS (appended to `src/App.css`)

New CSS classes:
- `.beginner-mode` — wrapper, centered, with fade animation
- `.beginner-card` — glassmorphic card container (matching `.modal` styling)
- `.beginner-header` — title + version
- `.beginner-form` — input + select layout
- `.beginner-input` — text input (matching `.modal-input` styling)
- `.beginner-select` — dropdown (matching `.modal-select` styling)
- `.beginner-play-btn` — play button (matching `.play-btn` styling)
- `.beginner-presets` — horizontal button row
- `.beginner-expand` — text link button

All colors use existing CSS custom properties (`--accent`, `--bg-void`, `--border`, `--text-primary`, etc.).

## 5. Data Flow

```
App.jsx initializes → hydrateState() loads profiles
  ↓
  if no profiles → setBeginnerMode(true)
  ↓
  App.jsx renders <CentralCard> (beginner mode)
    ├── versionCatalog loads → filter type==='vanilla' → vanillaVersions prop
    ├── User enters name → localName state
    ├── User selects version → selectedVanillaVersion state
    ├── User clicks preset → applyPreset() sets both
    ├── User clicks PLAY → handleBeginnerPlay():
    │     ├── handleSaveProfile() creates profile
    │     ├── handlePlay() launches game
    │     └── setBeginnerMode(false) after launch
    └── User clicks Expand → setBeginnerMode(false)
              ↓
            Full GUI renders (existing rendering path, unchanged)
```

## 6. Error Handling

| Scenario | Handling |
|---|---|
| Play clicked with empty name/version | Play button has `disabled={!localName \|\| !selectedVanillaVersion}` |
| Version catalog empty (offline first launch) | Dropdown shows "Select Minecraft version" with no options; Play stays disabled; Expand button still available |
| Preset version not yet in catalog | Preset button fills the name; version dropdown stays unchanged if version ID isn't found yet |
| App version unknown | Shows "..." (matching existing titlebar-version pattern) |
| User expands before launching | Full GUI renders normally; no data loss |

## 7. Edge Cases

| Scenario | Handling |
|---|---|
| User presses Enter in name input | Form doesn't auto-submit (no form wrapper); user clicks PLAY or preset |
| Window resized | Card is centered via flexbox; responsive via `max-width` on card |
| User switches language | Existing `useI18n` context handles it; beginner card uses same `t()` function |
| Multiple rapid clicks on presets | React batch-updates state; last click wins |

## 8. Testing

No test framework exists in this project. Verification is manual:

1. **First launch simulation**: Clear app data, start `npm run dev`, verify CentralCard appears
2. **Form interaction**: Type name, select version, verify Play enables
3. **Quick presets**: Click each preset, verify both fields fill
4. **Play button**: Enter name + select version, click PLAY, verify profile created and game launches
5. **Expand button**: Click "Show Full Launcher", verify full GUI appears
6. **Full GUI**: Verify all existing functionality works unchanged
7. **Production build**: `npx vite build` — no errors

## 9. Out of Scope

- Settings toggle to return to beginner mode (one-way expand for this iteration)
- Configurable preset buttons (hardcoded 3 presets)
- Fabric/Forge installation in beginner mode (expansion is the path for these)
- Animation micro-interactions beyond the existing fadeIn
- Mobile-specific layouts
- Accessibility features beyond existing app patterns

## 10. Files Affected

| File | Action | Lines |
|---|---|---|
| `src/components/CentralCard.jsx` | Create | ~130 lines |
| `src/App.jsx` | Modify | +~30 lines (state, render branch, handleBeginnerPlay) |
| `src/App.css` | Modify | +~60 lines (beginner mode CSS) |

## 11. Open Questions (Resolved)

| Question | Resolution |
|---|---|
| Minimal view scope? | Central card only; titlebar stays visible |
| Beginner mode trigger? | `beginnerMode = true` when `profiles.length === 0` after state load |
| Quick presets content? | Steve + 1.20.1, Alex + 1.21, Herobrine + 1.20.4 |
| Expand mechanism? | "Show Full Launcher" button (one-way, bottom of card) |
| Play behavior? | Creates default profile + calls existing handlePlay → auto-exits beginner mode |
