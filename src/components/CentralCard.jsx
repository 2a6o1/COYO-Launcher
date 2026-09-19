import { useState } from "react";
import logoImg from "../assets/1.png";

export default function CentralCard({
  localName,
  selectedVanillaVersion,
  vanillaVersions,
  onNameChange,
  onVersionChange,
  onPlay,
  onExpand,
  appVersion = "",
  profiles = [],
  onSelectProfile,
  installedVersions = [],
  onInstallVersion,
  isInstalling = false,
  installProgress = 0,
  javaInstalling = false,
  javaInstallProgress = 0,
}) {
  const [dropdownValue, setDropdownValue] = useState("");
  const [installSelectedVersion, setInstallSelectedVersion] = useState("");

  const getVersionId = (mcVer) => {
    const found = vanillaVersions.find((v) => v?.mcVer === mcVer);
    return found ? found.id : "";
  };

  const applyPreset = (name, mcVer) => {
    onNameChange(name);
    const versionId = getVersionId(mcVer);
    if (versionId) {
      onVersionChange(versionId);
    }
  };

  const canPlay =
    Boolean(localName && localName.trim()) && Boolean(selectedVanillaVersion);

  const userProfiles = (profiles || []).filter((p) => p.id !== "Default");
  const hasProfiles = userProfiles.length > 0;

  // Determine which vanilla versions are already installed locally
  const installedMcVers = new Set(
    (installedVersions || [])
      .filter((v) => v && (v.mcVer || v.id))
      .map((v) => v.mcVer || v.id),
  );
  const isVersionInstalled = (mcVer) => installedMcVers.has(mcVer);

  // Versions available to install (not yet installed)
  const uninstalledVersions = [
    ...vanillaVersions.filter((v) => v && !isVersionInstalled(v.mcVer)),
  ];

  return (
    <div className="beginner-card">
      <div className="beginner-header">
        <div className="beginner-logo">
          <img
            src={logoImg}
            alt="Coyo Launcher"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
        <h1>Coyo Launcher</h1>
        <span className="beginner-version">{appVersion || "..."}</span>
      </div>

      {hasProfiles ? (
        <>
          {/* Existing profiles — select & launch directly */}
          <div className="beginner-profile-selector">
            <select
              className="beginner-select"
              value={dropdownValue}
              onChange={(e) => setDropdownValue(e.target.value)}
            >
              <option value="">Select a profile to launch</option>
              {userProfiles.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} · {p.version || "No version"} · {p.ram || 4}GB
                </option>
              ))}
            </select>
            <button
              className="beginner-play-btn beginner-play-btn--compact"
              type="button"
              onClick={() => {
                const profile = userProfiles.find(
                  (p) => String(p.id) === dropdownValue,
                );
                onSelectProfile?.(profile);
              }}
              disabled={!dropdownValue}
            >
              PLAY
            </button>
          </div>

          <div className="beginner-divider">
            <span>or create new</span>
          </div>
        </>
      ) : null}

      {/* Quick-create form (always present) */}
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
            {vanillaVersions.length === 0
              ? "Loading versions..."
              : "Select Minecraft version"}
          </option>
          {vanillaVersions.map((v) => (
            <option key={v.id} value={v.id}>
              {isVersionInstalled(v.mcVer) ? "✓ " : "↓ "}
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Install Version Section */}
      <div className="beginner-install-section">
        {isInstalling ? (
          <div className="beginner-install-progress">
            <span className="beginner-install-status">
              Installing {Math.round(installProgress)}%...
            </span>
            <div className="beginner-install-bar">
              <div
                className="beginner-install-fill"
                style={{ width: `${Math.round(installProgress)}%` }}
              />
            </div>
          </div>
        ) : uninstalledVersions.length > 0 ? (
          <>
            <div className="beginner-install-row">
              <select
                className="beginner-select"
                value={installSelectedVersion}
                onChange={(e) => setInstallSelectedVersion(e.target.value)}
                disabled={vanillaVersions.length === 0}
              >
                <option value="">Install a new version...</option>
                {uninstalledVersions.map((v) => (
                  <option key={v.id} value={v.mcVer}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                className="beginner-install-btn"
                type="button"
                onClick={() => onInstallVersion?.(installSelectedVersion)}
                disabled={!installSelectedVersion}
              >
                Install
              </button>
            </div>
          </>
        ) : (
          <div className="beginner-install-all">
            <span>All versions installed</span>
          </div>
        )}
      </div>

      <button
        className={`beginner-play-btn ${javaInstalling ? 'beginner-play-btn--installing' : ''}`}
        type="button"
        onClick={onPlay}
        disabled={!canPlay || javaInstalling}
      >
        {javaInstalling ? (
          <>
            <span className="beginner-installing-spinner">⟳</span>
            Installing Java 25 ({Math.round(javaInstallProgress)}%)...
          </>
        ) : hasProfiles ? "CREATE & PLAY" : "PLAY"}
      </button>

      <div className="beginner-presets">
        <button type="button" onClick={() => applyPreset("Steve", "1.20.1")}>
          Steve + 1.20.1
        </button>
        <button type="button" onClick={() => applyPreset("Alex", "1.21")}>
          Alex + 1.21
        </button>
        <button
          type="button"
          onClick={() => applyPreset("Herobrine", "1.20.4")}
        >
          Herobrine + 1.20.4
        </button>
      </div>

      <button className="beginner-expand" type="button" onClick={onExpand}>
        Show Full Launcher →
      </button>
    </div>
  );
}
