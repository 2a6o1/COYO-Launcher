import fs from 'fs';
import path from 'path';
import { getProfileGameDir } from './profilePaths.js';

export function getProfileModsDir(minecraftRoot, profileId) {
  return path.join(getProfileGameDir(minecraftRoot, profileId), 'mods');
}

export async function readInstalledModsFromDir(modsDir) {
  const installed = [];
  try {
    const entries = await fs.promises.readdir(modsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lowerName = entry.name.toLowerCase();
      let modId = null;
      let enabled = false;
      if (lowerName.endsWith('.jar')) {
        modId = entry.name.replace(/\.jar$/i, '');
        enabled = true;
      } else if (lowerName.endsWith('.olpkg')) {
        modId = entry.name.replace(/\.olpkg$/i, '');
      }
      if (!modId) continue;
      installed.push({
        id: modId,
        name: modId,
        version: 'installed',
        type: 'jar',
        enabled,
        path: path.join(modsDir, entry.name),
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return installed;
}

function normalizeModId(modId) {
  const baseId = String(modId || '').replace(/\.(jar|olpkg)$/i, '').trim();
  if (!baseId || baseId === '.' || baseId === '..' || path.basename(baseId) !== baseId || /[\\/]/.test(baseId)) return null;
  return baseId;
}

async function resolveModFile(modsDir, modId, extension) {
  const baseId = normalizeModId(modId);
  if (!baseId) return null;
  const directPath = path.join(modsDir, `${baseId}.${extension}`);
  if (fs.existsSync(directPath)) return directPath;
  try {
    const entries = await fs.promises.readdir(modsDir, { withFileTypes: true });
    const match = entries.find(entry => entry.isFile() && entry.name.toLowerCase() === `${baseId}.${extension}`.toLowerCase());
    return match ? path.join(modsDir, match.name) : null;
  } catch {
    return null;
  }
}

export async function copyModFileToDir(modsDir, sourcePath, fileName) {
  const safeName = String(fileName || '').trim();
  const extension = path.extname(safeName).toLowerCase();
  if (!safeName || path.basename(safeName) !== safeName || !['.jar', '.olpkg'].includes(extension)) {
    return { error: 'BadInput', message: 'Invalid mod file name.' };
  }
  const stats = await fs.promises.stat(sourcePath).catch(() => null);
  if (!stats?.isFile()) return { error: 'NotFound', message: `File not found: ${sourcePath}` };
  await fs.promises.mkdir(modsDir, { recursive: true });
  const destinationPath = path.join(modsDir, safeName);
  if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
    await fs.promises.copyFile(sourcePath, destinationPath);
  }
  return { ok: true, path: destinationPath, enabled: extension === '.jar' };
}

export async function deleteModFilesInDir(modsDir, modId) {
  const baseId = normalizeModId(modId);
  if (!baseId) return { error: 'BadInput', message: 'Invalid mod ID.' };
  const targets = [path.join(modsDir, `${baseId}.jar`), path.join(modsDir, `${baseId}.olpkg`)];
  const existingPaths = targets.filter(existingPath => fs.existsSync(existingPath));
  if (existingPaths.length === 0) return { error: 'NotFound', message: `Mod not found: ${baseId}` };
  try {
    for (const existingPath of existingPaths) await fs.promises.unlink(existingPath);
    return { ok: true, removed: existingPaths };
  } catch (error) {
    return { error: 'DeleteFailed', message: error?.message || String(error) };
  }
}

export async function toggleModInDir(modsDir, modId, enable) {
  try {
    if (enable) {
      const disabledPath = await resolveModFile(modsDir, modId, 'olpkg');
      if (!disabledPath) return { error: 'NotFound', message: `Disabled mod not found: ${modId}.olpkg` };
      const baseId = normalizeModId(modId);
      if (!baseId) return { error: 'BadInput', message: 'Invalid mod ID.' };
      const enabledPath = path.join(modsDir, `${baseId}.jar`);
      await fs.promises.rename(disabledPath, enabledPath);
      return { ok: true, enabled: true };
    }

    const enabledPath = await resolveModFile(modsDir, modId, 'jar');
    if (!enabledPath) return { error: 'NotFound', message: `Enabled mod not found: ${modId}.jar` };
    const baseId = normalizeModId(modId);
    if (!baseId) return { error: 'BadInput', message: 'Invalid mod ID.' };
    const disabledPath = path.join(modsDir, `${baseId}.olpkg`);
    await fs.promises.rename(enabledPath, disabledPath);
    return { ok: true, enabled: false };
  } catch (error) {
    return { error: 'RenameFailed', message: error?.message || String(error) };
  }
}
