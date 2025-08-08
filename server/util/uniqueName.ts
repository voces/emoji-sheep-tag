import { Client } from "../client.ts";

/**
 * Generates a unique name by appending (2), (3), etc. if the base name is already taken
 * @param baseName The desired name
 * @param existingClients Set of existing clients to check against
 * @param currentClient The client requesting the name change (excluded from conflict check)
 * @returns A unique name
 */
export const generateUniqueName = (
  baseName: string,
  existingClients: Set<Client>,
  currentClient: Client,
): string => {
  // Remove any existing numbering from the base name to avoid double numbering
  const cleanBaseName = baseName.replace(/\s*\(\d+\)$/, "");

  // Check if the base name is available
  const isNameTaken = (name: string) => {
    for (const client of existingClients) {
      if (client !== currentClient && client.name === name) {
        return true;
      }
    }
    return false;
  };

  // If the clean base name is not taken, use it
  if (!isNameTaken(cleanBaseName)) {
    return cleanBaseName;
  }

  // Find the next available number
  let counter = 2;
  let uniqueName: string;
  do {
    uniqueName = `${cleanBaseName} (${counter})`;
    counter++;
  } while (isNameTaken(uniqueName));

  return uniqueName;
};
