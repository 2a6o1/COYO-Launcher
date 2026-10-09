const DIRECTORY_ARGUMENTS = new Set(['--gameDir', '--assetsDir', '--assetIndex']);

export function applySharedAndProfileGameDirectories(args, { gameDir, assetsDir, assetIndex }) {
  const normalizedArgs = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const equalsForm = typeof argument === 'string' && [...DIRECTORY_ARGUMENTS].some(flag => argument.startsWith(`${flag}=`));
    if (DIRECTORY_ARGUMENTS.has(argument)) {
      const nextArgument = args[index + 1];
      if (typeof nextArgument === 'string' && !nextArgument.startsWith('--')) index += 1;
      continue;
    }
    if (equalsForm) continue;
    normalizedArgs.push(argument);
  }

  return [
    ...normalizedArgs,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', assetIndex,
  ];
}
