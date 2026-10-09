import test from 'node:test';
import assert from 'node:assert/strict';
import { applySharedAndProfileGameDirectories } from './gameArgs.js';

test('does not consume the next flag when a directory option has no value', () => {
  const args = applySharedAndProfileGameDirectories([
    '--gameDir', '--username', 'Steve', '--assetsDir=', '--version', '1.21',
  ], {
    gameDir: '/profiles/one/game',
    assetsDir: '/minecraft/assets',
    assetIndex: '1.21',
  });

  assert.deepEqual(args, [
    '--username', 'Steve', '--version', '1.21',
    '--gameDir', '/profiles/one/game',
    '--assetsDir', '/minecraft/assets',
    '--assetIndex', '1.21',
  ]);
});

test('forces per-profile gameDir while preserving shared assets arguments', () => {
  const args = applySharedAndProfileGameDirectories([
    '--gameDir', '/old/global', '--username', 'Steve', '--assetsDir=/old/assets', '--assetIndex', 'legacy',
  ], {
    gameDir: '/profiles/one/game',
    assetsDir: '/minecraft/assets',
    assetIndex: '1.21',
  });

  assert.deepEqual(args, [
    '--username', 'Steve',
    '--gameDir', '/profiles/one/game',
    '--assetsDir', '/minecraft/assets',
    '--assetIndex', '1.21',
  ]);
});
