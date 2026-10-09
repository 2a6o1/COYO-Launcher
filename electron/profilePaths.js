import crypto from 'crypto';
import path from 'path';

export function getProfileGameDir(minecraftRoot, profileId) {
  if (typeof profileId !== 'string' && typeof profileId !== 'number') {
    throw new TypeError('A profile ID is required to resolve its game directory.');
  }

  const normalizedId = String(profileId).trim();
  if (!normalizedId) {
    throw new TypeError('A profile ID is required to resolve its game directory.');
  }

  const profileKey = crypto.createHash('sha256').update(normalizedId).digest('hex').slice(0, 32);
  return path.join(path.resolve(minecraftRoot), 'profiles', profileKey, 'game');
}
