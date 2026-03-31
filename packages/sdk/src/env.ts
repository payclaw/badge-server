/**
 * KYA_* env var resolution with PAYCLAW_* backward compat.
 * New name takes precedence. Stderr warning emitted once per old name.
 */
const warned = new Set<string>();

function resolveEnv(newName: string, oldName: string): string | undefined {
  const newVal = process.env[newName];
  if (newVal !== undefined && newVal.length > 0) return newVal;
  const oldVal = process.env[oldName];
  if (oldVal !== undefined && oldVal.length > 0) {
    if (!warned.has(oldName) && process.env.VITEST !== "true") {
      process.stderr.write(
        `[kyaLabs] WARNING: ${oldName} is deprecated. Use ${newName} instead.\n`
      );
      warned.add(oldName);
    }
    return oldVal;
  }
  return undefined;
}

export function getEnvApiKey(): string | undefined {
  return resolveEnv("KYA_API_KEY", "PAYCLAW_API_KEY");
}

export function getEnvApiUrl(): string | undefined {
  return resolveEnv("KYA_API_URL", "PAYCLAW_API_URL");
}

export function getEnvExtendedAuth(): boolean {
  const val = resolveEnv("KYA_EXTENDED_AUTH", "PAYCLAW_EXTENDED_AUTH");
  return val === "true" || val === "1";
}

