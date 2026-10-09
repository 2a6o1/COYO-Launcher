import test from 'node:test';
import assert from 'node:assert/strict';
import { appendJvmArgument, appendJvmArguments, tokenizeJvmArguments } from './jvmArgs.js';

const DEFAULT_JVM_ARGS = [
  '-Djava.library.path=/game/native-extract/version',
  '-Xmx8G',
  '--add-exports', 'java.base/jdk.internal.ref=ALL-UNNAMED',
  '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
  '--add-opens', 'java.base/sun.nio.ch=ALL-UNNAMED',
  '--add-opens', 'java.base/sun.security.action=ALL-UNNAMED',
  '--add-opens', 'java.base/java.util=ALL-UNNAMED',
  '--add-opens', 'java.base/java.util.concurrent=ALL-UNNAMED',
];

test('keeps distinct repeated JVM flags paired with their operands', () => {
  const args = [...DEFAULT_JVM_ARGS];

  appendJvmArguments(args, [
    '--add-opens',
    'java.base/java.lang.invoke=ALL-UNNAMED',
    '--add-opens',
    'java.base/java.lang.reflect=ALL-UNNAMED',
  ]);

  assert.deepEqual(args.slice(-4), [
    '--add-opens', 'java.base/java.lang.invoke=ALL-UNNAMED',
    '--add-opens', 'java.base/java.lang.reflect=ALL-UNNAMED',
  ]);
});

test('keeps Fabric metadata JVM entry atomic before classpath and main class', () => {
  const jvmArgs = [];
  appendJvmArgument(jvmArgs, '-DFabricMcEmu= net.minecraft.client.main.Main ');
  appendJvmArgument(jvmArgs, '   ');
  const args = [...jvmArgs, '-cp', '/minecraft/libraries/*', 'net.fabricmc.loader.impl.launch.knot.KnotClient'];

  assert.deepEqual(args, [
    '-DFabricMcEmu= net.minecraft.client.main.Main',
    '-cp',
    '/minecraft/libraries/*',
    'net.fabricmc.loader.impl.launch.knot.KnotClient',
  ]);
  assert.equal(args.includes('net.minecraft.client.main.Main'), false);
});

test('preserves equals-form JVM options and ignores empty input', () => {
  assert.deepEqual(tokenizeJvmArguments('--add-opens=java.base/java.lang.invoke=ALL-UNNAMED'), [
    '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
  ]);
  assert.deepEqual(tokenizeJvmArguments('--sun-misc-unsafe-memory-access=allow'), [
    '--sun-misc-unsafe-memory-access=allow',
  ]);
  assert.deepEqual(tokenizeJvmArguments('-Djava.library.path=/game/natives'), [
    '-Djava.library.path=/game/natives',
  ]);
  assert.deepEqual(tokenizeJvmArguments('  \n\t '), []);
});
