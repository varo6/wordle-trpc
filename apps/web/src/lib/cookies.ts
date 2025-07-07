/**
 * Cookie utility functions for game state management
 */

export interface GameState {
  currentRow: number;
  gameBoard: Array<
    Array<{ letter: string; status: "ok" | "almost" | "no" | null }>
  >;
  keyStatus: Record<string, "ok" | "almost" | "no" | undefined>;
  gameOver: boolean;
  currentGuess: string;
  lastSaved: number; // timestamp when saved
  isCompleted?: boolean; // New: Flag for completed games
  won?: boolean; // New: Flag if the game was won
}

/**
 * Set a cookie with expiration in minutes
 */
export function setCookie(
  name: string,
  value: string,
  expirationMinutes: number,
): void {
  const date = new Date();
  date.setTime(date.getTime() + expirationMinutes * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(";");

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") {
      c = c.substring(1, c.length);
    }
    if (c.indexOf(nameEQ) === 0) {
      return c.substring(nameEQ.length, c.length);
    }
  }
  return null;
}

/**
 * Delete a cookie by setting its expiration to the past
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}

/**
 * Save game state to cookies with expiration based on time to next epoch
 */
export function saveGameState(
  gameState: GameState,
  minutesToEpoch: number,
): void {
  try {
    const stateWithTimestamp = {
      ...gameState,
      lastSaved: Date.now(),
    };

    const serializedState = JSON.stringify(stateWithTimestamp);
    console.log(
      "Saving game state:",
      serializedState,
      "expires in:",
      minutesToEpoch,
    ); // Debug log
    setCookie("wordleGameState", serializedState, minutesToEpoch);

    // Also save a flag to know we have a saved game
    setCookie("wordleHasSavedGame", "true", minutesToEpoch);
  } catch (error) {
    console.error("Failed to save game state to cookies:", error);
  }
}

/**
 * Load game state from cookies
 */
export function loadGameState(): GameState | null {
  try {
    const hasSavedGame = getCookie("wordleHasSavedGame");
    console.log("Has saved game?", hasSavedGame); // Debug log
    if (!hasSavedGame) {
      return null;
    }

    const serializedState = getCookie("wordleGameState");
    console.log("Loaded serialized state:", serializedState); // Debug log
    if (!serializedState) {
      return null;
    }

    const gameState = JSON.parse(serializedState) as GameState;

    // Set defaults for new fields (backward compatibility)
    gameState.isCompleted = gameState.isCompleted ?? false;
    gameState.won = gameState.won ?? false;

    // Validate that the saved state has required properties
    if (
      typeof gameState.currentRow !== "number" ||
      !Array.isArray(gameState.gameBoard) ||
      typeof gameState.keyStatus !== "object" ||
      typeof gameState.gameOver !== "boolean"
    ) {
      console.warn("Invalid game state format in cookies, clearing...");
      clearGameState();
      return null;
    }

    return gameState;
  } catch (error) {
    console.error("Failed to load game state from cookies:", error);
    clearGameState(); // Clear invalid data
    return null;
  }
}

/**
 * Clear game state from cookies
 */
export function clearGameState(): void {
  deleteCookie("wordleGameState");
  deleteCookie("wordleHasSavedGame");
}

/**
 * Check if there's a saved game in cookies
 */
export function hasSavedGame(): boolean {
  return getCookie("wordleHasSavedGame") === "true";
}

/**
 * Get the timestamp when the game was last saved
 */
export function getLastSavedTimestamp(): number | null {
  try {
    const gameState = loadGameState();
    return gameState?.lastSaved || null;
  } catch {
    return null;
  }
}
