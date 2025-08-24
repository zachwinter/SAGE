export function processServerConfigEnvVars(config) {
  const errors = [];
  const warnings = [];

  // For now, just return the config as-is since we're not doing complex env var processing
  return {
    config,
    errors,
    warnings
  };
}
