import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLauncherState } from './launcherState.js';

const makeState = (profiles) => ({
  profiles,
  mods: [],
  logs: [],
  versions: [],
  settings: {},
});

test('merges incoming profiles by ID without dropping unrelated profiles', () => {
  const current = makeState([
    { id: 'existing', name: 'Existing' },
    { id: 'other', name: 'Other' },
  ]);
  const deletedIds = new Set();

  const merged = mergeLauncherState(
    current,
    { profiles: [{ id: 'existing', name: 'Updated' }, { id: 'new', name: 'New' }] },
    deletedIds,
  );

  assert.deepEqual(merged.profiles, [
    { id: 'existing', name: 'Updated' },
    { id: 'other', name: 'Other' },
    { id: 'new', name: 'New' },
  ]);
});

test('explicit deletion wins over an incoming profile and remains effective later', () => {
  const deletedIds = new Set();
  const current = makeState([
    { id: 'deleted', name: 'Deleted' },
    { id: 'kept', name: 'Kept' },
  ]);

  const afterDelete = mergeLauncherState(
    current,
    {
      profiles: [{ id: 'deleted', name: 'Stale copy' }, { id: 'kept', name: 'Kept' }],
      _deletedProfileIds: ['deleted'],
    },
    deletedIds,
  );
  const afterLaterSave = mergeLauncherState(afterDelete, {
    profiles: [{ id: 'deleted', name: 'Another stale copy' }],
    logs: [],
  }, deletedIds);

  assert.deepEqual(afterDelete.profiles, [{ id: 'kept', name: 'Kept' }]);
  assert.deepEqual(afterLaterSave.profiles, [{ id: 'kept', name: 'Kept' }]);
  assert.equal('_deletedProfileIds' in afterDelete, false);
});

test('restoring a deleted ID permits a later WWW3 installation to recreate it', () => {
  const deletedIds = new Set(['www3-profile']);
  const restoredProfile = { id: 'www3-profile', name: 'WWW3 pending', _pending: true };

  const restored = mergeLauncherState(
    makeState([]),
    { profiles: [restoredProfile], _restoredProfileIds: ['www3-profile'] },
    deletedIds,
  );

  const completed = mergeLauncherState(restored, {
    profiles: [{ id: 'www3-profile', name: 'WWW3', _pending: false }],
  }, deletedIds);

  assert.deepEqual(restored.profiles, [restoredProfile]);
  assert.deepEqual(completed.profiles, [
    { id: 'www3-profile', name: 'WWW3', _pending: false },
  ]);
  assert.equal(deletedIds.has('www3-profile'), false);
  assert.equal('_restoredProfileIds' in restored, false);
});
