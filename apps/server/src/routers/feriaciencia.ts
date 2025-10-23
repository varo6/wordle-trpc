import z from "zod/v4";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { router, publicProcedure } from "../lib/trpc";
import cyberwords from "../lib/cyberwords";
import words from "../lib/words";
import { compareStrings } from "@/lib/word";
import { db } from "../db";
import { feriaGameStats, feriaWordStats } from "../db/schema/feria";

const CYBERWORD_SET = new Set(
  cyberwords.words.map((word) => word.toLowerCase()),
);
const AVAILABLE_WORDS = Array.from(CYBERWORD_SET).filter(
  (word) => word.length === 5,
);

type ActiveGame = {
  word: string;
  createdAt: number;
  completed: boolean;
};

const activeGames = new Map<string, ActiveGame>();
const GAME_TTL_MS = 1000 * 60 * 60; // 1 hour

function cleanupExpiredGames() {
  const now = Date.now();
  for (const [gameId, game] of activeGames.entries()) {
    if (now - game.createdAt > GAME_TTL_MS) {
      activeGames.delete(gameId);
    }
  }
}

function getRandomWord(): string {
  if (AVAILABLE_WORDS.length === 0) {
    throw new Error("No hay palabras disponibles para el modo feriaciencia");
  }

  const index = Math.floor(Math.random() * AVAILABLE_WORDS.length);
  return AVAILABLE_WORDS[index];
}

function getActiveGame(gameId: string): ActiveGame | null {
  cleanupExpiredGames();
  const game = activeGames.get(gameId);
  if (!game) {
    return null;
  }

  return game;
}

async function recordGameStats(word: string, won: boolean) {
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(feriaGameStats)
        .values({
          id: 1,
          completedGames: 1,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
        })
        .onConflictDoUpdate({
          target: feriaGameStats.id,
          set: {
            completedGames: sql`${feriaGameStats.completedGames} + 1`,
            wins: sql`${feriaGameStats.wins} + ${won ? 1 : 0}`,
            losses: sql`${feriaGameStats.losses} + ${won ? 0 : 1}`,
          },
        });

      if (won) {
        await tx
          .insert(feriaWordStats)
          .values({
            word: word.toLowerCase(),
            correctGuesses: 1,
            incorrectGuesses: 0,
          })
          .onConflictDoUpdate({
            target: feriaWordStats.word,
            set: {
              correctGuesses: sql`${feriaWordStats.correctGuesses} + 1`,
              incorrectGuesses: feriaWordStats.incorrectGuesses,
            },
          });
      } else {
        await tx
          .insert(feriaWordStats)
          .values({
            word: word.toLowerCase(),
            correctGuesses: 0,
            incorrectGuesses: 1,
          })
          .onConflictDoUpdate({
            target: feriaWordStats.word,
            set: {
              correctGuesses: feriaWordStats.correctGuesses,
              incorrectGuesses: sql`${feriaWordStats.incorrectGuesses} + 1`,
            },
          });
      }
    });

    return { success: true as const };
  } catch (error) {
    console.error("Error recording feria stats", error);
    const message =
      error instanceof Error && error.message
        ? `No se pudieron actualizar las estadísticas (${error.message}).`
        : "No se pudieron actualizar las estadísticas.";

    return {
      success: false as const,
      error: message,
    };
  }
}

export const feriacienciaRouter = router({
  startGame: publicProcedure.mutation(() => {
    const word = getRandomWord();
    const gameId = randomUUID();

    activeGames.set(gameId, {
      word,
      createdAt: Date.now(),
      completed: false,
    });

    return {
      gameId,
      length: word.length,
      word,
    };
  }),

  tryWord: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
        guess: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const guess = input.guess.toLowerCase();
      const game = getActiveGame(input.gameId);

      if (!game) {
        return {
          isValid: false,
          isCorrect: false,
          result: Array(guess.length)
            .fill(null)
            .map(() => "no") as ("ok" | "almost" | "no")[],
          error: "Juego no encontrado o expirado",
        };
      }

      if (game.completed) {
        return {
          isValid: false,
          isCorrect: false,
          result: Array(guess.length)
            .fill(null)
            .map(() => "no") as ("ok" | "almost" | "no")[],
          error: "El juego ya fue completado",
        };
      }

      // Ensure guess has correct length
      if (guess.length !== game.word.length) {
        return {
          isValid: false,
          isCorrect: false,
          result: Array(game.word.length)
            .fill(null)
            .map(() => "no") as ("ok" | "almost" | "no")[],
          error: "La palabra debe tener 5 letras",
        };
      }

      const response = {
        isValid: false,
        isCorrect: false,
        result: Array(game.word.length)
          .fill(null)
          .map(() => "no") as ("ok" | "almost" | "no")[],
      };

      if (words.words.includes(guess) || CYBERWORD_SET.has(guess)) {
        response.isValid = true;
        response.result = compareStrings(game.word, guess);
        response.isCorrect = guess === game.word;

        if (response.isCorrect) {
          game.completed = true;
        }
      }

      return response;
    }),

  getWord: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
      }),
    )
    .query(({ input }) => {
      const game = getActiveGame(input.gameId);
      return {
        word: game?.word ?? null,
      };
    }),

  recordGameResult: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
        won: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const game = getActiveGame(input.gameId);

      if (!game) {
        return {
          success: false,
          dbUpdated: false,
          error: "Juego no encontrado o expirado",
        };
      }

      const effectiveWin = input.won && game.completed;
      const dbResult = await recordGameStats(game.word, effectiveWin);

      // Remove the game from memory to avoid reuse regardless of DB outcome
      activeGames.delete(input.gameId);

      return {
        success: true,
        dbUpdated: dbResult.success,
        ...(dbResult.success ? {} : { error: dbResult.error }),
      };
    }),

  getStats: publicProcedure.query(async () => {
    try {
      const [statsRow] = await db.select().from(feriaGameStats).limit(1);
      const wordRows = await db.select().from(feriaWordStats);

      const wordCounts = new Map(
        wordRows.map((row) => [
          row.word.toLowerCase(),
          {
            correctGuesses: row.correctGuesses,
            incorrectGuesses: row.incorrectGuesses,
          },
        ]),
      );

      const allWordStats = AVAILABLE_WORDS.map((word) => ({
        word,
        correctGuesses: wordCounts.get(word)?.correctGuesses ?? 0,
        incorrectGuesses: wordCounts.get(word)?.incorrectGuesses ?? 0,
      })).sort((a, b) => {
        if (b.correctGuesses === a.correctGuesses) {
          return a.word.localeCompare(b.word);
        }
        return b.correctGuesses - a.correctGuesses;
      });

      return {
        dbAvailable: true,
        completedGames: statsRow?.completedGames ?? 0,
        wins: statsRow?.wins ?? 0,
        losses: statsRow?.losses ?? 0,
        wordStats: allWordStats,
      };
    } catch (error) {
      console.error("Error loading feria stats", error);
      return {
        dbAvailable: false,
        completedGames: 0,
        wins: 0,
        losses: 0,
        wordStats: AVAILABLE_WORDS.map((word) => ({
          word,
          correctGuesses: 0,
          incorrectGuesses: 0,
        })).sort((a, b) => a.word.localeCompare(b.word)),
      };
    }
  }),
});
