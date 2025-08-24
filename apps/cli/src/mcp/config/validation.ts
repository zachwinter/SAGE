export function validateServerConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config.id) {
    errors.push("Server config must have an id");
  }

  if (!config.name) {
    errors.push("Server config must have a name");
  }

  if (!config.type) {
    errors.push("Server config must have a type");
  } else if (!["stdio", "http", "adapter"].includes(config.type)) {
    errors.push("Server config type must be stdio, http, or adapter");
  }

  if (config.type === "stdio" && !config.command) {
    errors.push("stdio server config must have a command");
  }

  if (config.type === "http" && !config.url) {
    errors.push("http server config must have a url");
  }

  if (typeof config.enabled !== "boolean") {
    errors.push("Server config enabled must be a boolean");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateMcpJsonConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config.mcpServers) {
    errors.push("MCP JSON config must have mcpServers object");
  } else if (typeof config.mcpServers !== "object") {
    errors.push("mcpServers must be an object");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function normalizeServerConfig(config) {
  if (!config) return null;

  return {
    ...config,
    enabled: Boolean(config.enabled),
    args: config.args || [],
    env: config.env || {}
  };
}
