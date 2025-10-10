import { lobbies } from "../lobby.ts";

const adjectives = [
  // Rots
  "Flash",
  "Tiny",
  // UST
  "Black",
  "Silver",
  "Golden",
  "Stun",
  // Revo
  "Frost",
  "Strong",
  "Magic",
  "Invisible",
  "Upgraded",
  "Wide",
  "Hard",
  "Stack",
  "Iron",
  "Cyclone",
];

const nouns = [
  // EST
  "Sheep",
  "Wolf",
  "Wolves",
  "Spirit",
  "Spirits",
  "Bird",
  "Birds",
  "Fox",
  "Foxes",
  "Hut",
  "Huts",
  "Bomber",
  "Bombers",
  "Ward",
  "Wards",
  // Revo
  "Golem",
  "Golems",
  "Goblins",
  "Nuke",
  "Nukes",
  "Farm",
  "Farms",
  // UST
  "Phoenix",
];

/** Check if a lobby name is already in use */
const isNameTaken = (name: string): boolean => {
  return Array.from(lobbies).some((lobby) => lobby.name === name);
};

/** Generate a random lobby name */
const generateRandomName = (): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective} ${noun}`;
};

/**
 * Generate a unique lobby name.
 * Tries several random combinations before falling back to numbered names.
 */
export const generateLobbyName = (): string => {
  // Try up to 10 random name combinations
  for (let i = 0; i < 10; i++) {
    const name = generateRandomName();
    if (!isNameTaken(name)) {
      return name;
    }
  }

  // Fallback: append numbers to a random name
  const baseName = generateRandomName();
  let counter = 2;
  while (isNameTaken(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
};
