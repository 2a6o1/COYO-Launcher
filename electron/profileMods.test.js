import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { copyModFileToDir, deleteModFilesInDir, getProfileModsDir, readInstalledModsFromDir, toggleModInDir } from './profileMods.js';

async function withTempRoot(run) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'launcher-profiles-'));
  try {
    await run(root);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

test('profile mod directories and operations stay isolated', async () => {
  await withTempRoot(async root => {
    const firstMods = getProfileModsDir(root, 'first');
    const secondMods = getProfileModsDir(root, 'second');
    const legacyMods = path.join(root, 'mods');
    const sourceDir = path.join(root, 'source');
    await Promise.all([
      fs.promises.mkdir(firstMods, { recursive: true }),
      fs.promises.mkdir(secondMods, { recursive: true }),
      fs.promises.mkdir(legacyMods, { recursive: true }),
      fs.promises.mkdir(sourceDir, { recursive: true }),
    ]);
    const sourceMod = path.join(sourceDir, 'imported.jar');
    await fs.promises.writeFile(sourceMod, 'imported');
    await Promise.all([
      fs.promises.writeFile(path.join(firstMods, 'first-mod.jar'), 'first'),
      fs.promises.writeFile(path.join(secondMods, 'second-mod.jar'), 'second'),
      fs.promises.writeFile(path.join(legacyMods, 'legacy-mod.jar'), 'legacy'),
    ]);

    assert.deepEqual((await readInstalledModsFromDir(firstMods)).map(mod => mod.id), ['first-mod']);
    assert.deepEqual((await readInstalledModsFromDir(secondMods)).map(mod => mod.id), ['second-mod']);
    assert.deepEqual(await toggleModInDir(firstMods, 'first-mod', false), { ok: true, enabled: false });
    assert.equal(fs.existsSync(path.join(firstMods, 'first-mod.olpkg')), true);
    assert.equal(fs.existsSync(path.join(secondMods, 'second-mod.jar')), true);
    assert.equal(fs.existsSync(path.join(legacyMods, 'legacy-mod.jar')), true);

    const copy = await copyModFileToDir(firstMods, sourceMod, 'imported.jar');
    assert.equal(copy.ok, true);
    assert.equal(fs.existsSync(path.join(firstMods, 'imported.jar')), true);
    assert.equal(fs.existsSync(path.join(secondMods, 'imported.jar')), false);
    assert.deepEqual(await deleteModFilesInDir(firstMods, 'imported'), {
      ok: true,
      removed: [path.join(firstMods, 'imported.jar')],
    });
    assert.equal(fs.existsSync(path.join(firstMods, 'imported.jar')), false);
    assert.equal(fs.existsSync(sourceMod), true);
  });
});
