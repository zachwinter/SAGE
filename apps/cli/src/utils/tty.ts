export function checkTTY() {
  try {
    const setRawModeExists = typeof process.stdin.setRawMode === "function";
    const supportsRawMode = process.stdin.isTTY && setRawModeExists;

    if (!supportsRawMode) {
      console.error("Raw mode (TTY) is required for the interactive interface.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error: Unable to initialize interactive mode.");
    process.exit(1);
  }
}
