export function readApiKey(envVarName: string): string | undefined {
  if (!envVarName) return undefined;
  return process.env[envVarName] || undefined;
}

export function requireApiKey(envVarName: string): string {
  const key = readApiKey(envVarName);
  if (!key) {
    throw new Error(
      `Required API key environment variable "${envVarName}" is not set.\n` +
      `Set it with: export ${envVarName}="your-key-here" (or setx on Windows)`
    );
  }
  return key;
}
