export function tokenizeJvmArguments(value) {
  const values = Array.isArray(value) ? value : [value];
  const tokens = [];

  for (const item of values) {
    if (typeof item !== 'string') continue;
    const splitArgs = item.trim().split(/\s+/).filter(Boolean);
    tokens.push(...splitArgs);
  }

  return tokens;
}

export function appendJvmArgument(target, value) {
  if (typeof value !== 'string') return;
  const argument = value.trim();
  if (argument) target.push(argument);
}

export function appendJvmArguments(target, value) {
  target.push(...tokenizeJvmArguments(value));
}
