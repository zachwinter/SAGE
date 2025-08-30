/**
 * Color utilities for CLI output
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Apply color formatting to text
 */
function colorize(text: string, color: string): string {
  return `${color}${text}${colors.reset}`;
}

/**
 * Success message (green)
 */
export function success(text: string): string {
  return colorize(text, colors.green);
}

/**
 * Error message (red)
 */
export function error(text: string): string {
  return colorize(text, colors.red);
}

/**
 * Info message (blue)
 */
export function info(text: string): string {
  return colorize(text, colors.blue);
}

/**
 * Warning message (yellow)
 */
export function warning(text: string): string {
  return colorize(text, colors.yellow);
}

/**
 * Highlight text (bright/bold)
 */
export function highlight(text: string): string {
  return colorize(text, colors.bright);
}