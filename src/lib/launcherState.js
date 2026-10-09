import fs from 'fs/promises';
import path from 'path';

const STATE_FILE_NAME = 'launcher-state.json';

export const DEFAULT_LAUNCHER_STATE = {
  profiles: [],
  mods: [],
  logs: [],
  versions: [],
  settings: {
    javaPath: '',
    keepOpen: false,
    showConsole: true,
    autoUpdate: true,
    showSnapshots: false,
    language: 'es',
    showBeginnerTutorial: true,
  },
  installTargets: {
    minecraft: { title: 'Install Minecraft', versions: [] },
    fabric: { title: 'Install Fabric', versions: [] },
    forge: { title: 'Install Forge', versions: [] },
  },
  latest: { minecraft: 'unknown' },
};

function stateFilePath(storageDir) {
  return path.join(storageDir, STATE_FILE_NAME);
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeSettings(settings, fallbackSettings = DEFAULT_LAUNCHER_STATE.settings) {
  return {
    javaPath: typeof settings?.javaPath === 'string' ? settings.javaPath : fallbackSettings.javaPath,
    keepOpen: typeof settings?.keepOpen === 'boolean' ? settings.keepOpen : fallbackSettings.keepOpen,
    showConsole: typeof settings?.showConsole === 'boolean' ? settings.showConsole : fallbackSettings.showConsole,
    autoUpdate: typeof settings?.autoUpdate === 'boolean' ? settings.autoUpdate : fallbackSettings.autoUpdate,
    showSnapshots: typeof settings?.showSnapshots === 'boolean' ? settings.showSnapshots : fallbackSettings.showSnapshots,
    language: typeof settings?.language === 'string' && settings.language.trim()
      ? settings.language.trim()
      : fallbackSettings.language,
    showBeginnerTutorial:
      typeof settings?.showBeginnerTutorial === 'boolean'
        ? settings.showBeginnerTutorial
        : fallbackSettings.showBeginnerTutorial,
  };
}

export async function loadLauncherState(storageDir) {
  const state = await readJsonFile(stateFilePath(storageDir), DEFAULT_LAUNCHER_STATE);
  return {
    profiles: Array.isArray(state.profiles) ? state.profiles : [],
    mods: Array.isArray(state.mods) ? state.mods : [],
    logs: Array.isArray(state.logs) ? state.logs : [],
    versions: Array.isArray(state.versions) ? state.versions : [],
    settings: normalizeSettings(state.settings, DEFAULT_LAUNCHER_STATE.settings),
    installTargets: state.installTargets && typeof state.installTargets === 'object'
      ? state.installTargets
      : DEFAULT_LAUNCHER_STATE.installTargets,
    latest: state.latest && typeof state.latest === 'object'
      ? state.latest
      : DEFAULT_LAUNCHER_STATE.latest,
  };
}

export function mergeLauncherState(currentState, partialState = {}, deletedProfileIds = new Set()) {
  const mergedState = { ...currentState };
  const deletedIds = Array.isArray(partialState?._deletedProfileIds)
    ? partialState._deletedProfileIds
    : [];
  const restoredIds = Array.isArray(partialState?._restoredProfileIds)
    ? partialState._restoredProfileIds
    : [];
  for (const id of restoredIds) deletedProfileIds.delete(id);
  for (const id of deletedIds) deletedProfileIds.add(id);

  for (const [key, value] of Object.entries(partialState || {})) {
    if (value === undefined) continue;

    if (key === 'profiles' && Array.isArray(value) && Array.isArray(currentState.profiles)) {
      const mergedProfiles = [...currentState.profiles];
      for (const incoming of value) {
        if (!incoming || !incoming.id) continue;
        const idx = mergedProfiles.findIndex(profile => profile.id === incoming.id);
        if (idx >= 0) mergedProfiles[idx] = incoming;
        else mergedProfiles.push(incoming);
      }
      mergedState.profiles = mergedProfiles;
    } else {
      mergedState[key] = value;
    }
  }

  if (deletedProfileIds.size > 0) {
    mergedState.profiles = (mergedState.profiles || []).filter(
      profile => !deletedProfileIds.has(profile.id),
    );
  }
  delete mergedState._deletedProfileIds;
  delete mergedState._restoredProfileIds;
  return mergedState;
}

export async function saveLauncherState(storageDir, state) {
  const normalizedState = {
    profiles: Array.isArray(state?.profiles) ? state.profiles : [],
    mods: Array.isArray(state?.mods) ? state.mods : [],
    logs: Array.isArray(state?.logs) ? state.logs : [],
    versions: Array.isArray(state?.versions) ? state.versions : [],
    settings: normalizeSettings(state?.settings, DEFAULT_LAUNCHER_STATE.settings),
    installTargets: state?.installTargets && typeof state.installTargets === 'object'
      ? state.installTargets
      : DEFAULT_LAUNCHER_STATE.installTargets,
    latest: state?.latest && typeof state.latest === 'object'
      ? state.latest
      : DEFAULT_LAUNCHER_STATE.latest,
  };

  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(stateFilePath(storageDir), JSON.stringify(normalizedState, null, 2), 'utf8');
  return normalizedState;
}