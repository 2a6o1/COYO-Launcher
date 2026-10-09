import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getProfileGameDir } from './profilePaths.js';

const root = path.resolve('/minecraft');

test('resolves a stable game directory per profile ID', () => {
  assert.equal(getProfileGameDir(root, 'profile-1'), getProfileGameDir(root, 'profile-1'));
  assert.notEqual(getProfileGameDir(root, 'profile-1'), getProfileGameDir(root, 'profile-2'));
  assert.equal(getProfileGameDir(root, 123), getProfileGameDir(root, '123'));
});

test('does not use profile names or versions to resolve the directory', () => {
  const id = 'profile-1';
  const first = getProfileGameDir(root, id);
  const renamed = getProfileGameDir(root, id);
  assert.equal(first, renamed);
});

test('profile IDs cannot escape the profiles directory', () => {
  const resolved = getProfileGameDir(root, '../../outside');
  const profilesRoot = path.join(root, 'profiles') + path.sep;
  assert.ok(resolved.startsWith(profilesRoot));
  assert.throws(() => getProfileGameDir(root, ''), /profile ID is required/i);
  assert.throws(() => getProfileGameDir(root, null), /profile ID is required/i);
});
