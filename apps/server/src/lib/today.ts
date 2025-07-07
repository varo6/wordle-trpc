import words from "./words";

// Cache for the current word
let cachedWord: string | null = null;
let cachedDay: number | null = null;
let cachedSeed: string | null = null;

/**
 * Get the current day number (days since epoch) in Madrid timezone
 * @returns Number of days since Unix epoch
 */
function getCurrentDayNumber(): number {
  const madridDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
  );
  madridDate.setHours(0, 0, 0, 0);
  return Math.floor(madridDate.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Calculate today's word based on a seed and the current date (Madrid time)
 * @param seed A string seed for reproducibility
 * @returns The word of the day
 */
export function getTodaysWord(seed: string): string {
  const wordList = words.words;

  if (!wordList.length) {
    return "No words available";
  }

  // Calculate days since Unix epoch (January 1, 1970)
  const daysSinceEpoch = getCurrentDayNumber();

  // Create a deterministic hash combining the seed and day
  const combined = seed + daysSinceEpoch.toString();
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  // Ensure positive value and select word
  const index = Math.abs(hash) % wordList.length;
  const word = wordList[index];
  return word;
}

/**
 * Get today's word using the default seed from environment variables
 * Uses caching to avoid recalculating the word on every call
 * @returns The word of the day
 */
export function getCurrentWord(): string {
  const seed = process.env.WORD_SEED || "semilla";
  const currentDay = getCurrentDayNumber();

  // Check if we have a valid cached word for today
  if (cachedWord !== null && cachedDay === currentDay && cachedSeed === seed) {
    return cachedWord;
  }

  // Calculate new word and cache it
  cachedWord = getTodaysWord(seed);
  cachedDay = currentDay;
  cachedSeed = seed;

  return cachedWord;
}

/**
 * Clear the cached word (useful for testing or forcing refresh)
 */
export function clearWordCache(): void {
  cachedWord = null;
  cachedDay = null;
  cachedSeed = null;
}
