import { z } from "zod";

/**
 * Creates a boolean schema that accepts various boolean-like inputs and normalizes them.
 *
 * Accepts:
 * - Actual booleans: true, false
 * - String representations: "true", "false", "True", "False"
 * - Numeric strings: "1", "0"
 * - Natural language: "yes", "no", "y", "n"
 *
 * @param description Optional description for the schema
 * @returns A Zod schema that normalizes boolean-like inputs to actual booleans
 */
export function flexibleBoolean(description?: string) {
  return z
    .union([
      z.boolean(),
      z.string().transform(val => {
        const normalized = val.toLowerCase().trim();

        // True values
        if (
          ["true", "1", "yes", "y", "on", "enable", "enabled"].includes(normalized)
        ) {
          return true;
        }

        // False values
        if (
          ["false", "0", "no", "n", "off", "disable", "disabled"].includes(
            normalized
          )
        ) {
          return false;
        }

        throw new Error(
          `Invalid boolean value: "${val}". Expected boolean or string like "true", "false", "yes", "no", "1", "0"`
        );
      })
    ])
    .describe(
      description ||
        "Boolean value (accepts: true/false, 'true'/'false', '1'/'0', 'yes'/'no', etc.)"
    );
}

/**
 * Creates an optional flexible boolean schema
 */
export function optionalFlexibleBoolean(description?: string) {
  return flexibleBoolean(description).optional();
}

/**
 * Creates a flexible boolean with a default value
 */
export function defaultFlexibleBoolean(defaultValue: boolean, description?: string) {
  return flexibleBoolean(description).default(defaultValue);
}
