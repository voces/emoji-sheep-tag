import { z } from "npm:zod";

/**
 * Plucks a deep value from an object using a dot-separated key path and validates it against the provided Zod schema.
 * Returns the validated value or undefined if the property doesn't exist or fails validation.
 *
 * @param obj - The unknown value (object) from which to pluck a property.
 * @param path - A dot-separated string (e.g., "a.b.c.d") specifying the property path.
 * @param schema - A Zod schema that is used to validate the plucked value.
 * @returns The validated value or undefined.
 */
export const pluck = <T>(
  obj: unknown,
  path: string,
  schema: z.ZodType<T>,
): T | undefined => {
  const parts = path.split(".");

  // Traverse the object using the property path
  let current: unknown = obj;
  for (const part of parts) {
    if (
      current !== null &&
      typeof current === "object" &&
      part in current
    ) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined; // the path doesn't exist
    }
  }

  // Validate the final value using the provided schema.
  const result = schema.safeParse(current);
  return result.success ? result.data : undefined;
};
