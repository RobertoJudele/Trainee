export interface RequireEnvOptions {
  allowEmpty?: boolean;
}

const normalize = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getOptionalEnv = (
  name: string,
  fallback?: string
): string | undefined => {
  const value = normalize(process.env[name]);
  if (value !== undefined) {
    return value;
  }

  return fallback;
};

export const getRequiredEnv = (
  name: string,
  options?: RequireEnvOptions
): string => {
  const raw = process.env[name];
  if (raw === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (options?.allowEmpty) {
    return raw;
  }

  const value = normalize(raw);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const hasEnv = (name: string): boolean => normalize(process.env[name]) !== undefined;
