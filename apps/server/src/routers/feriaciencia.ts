import z from "zod/v4";
import { randomUUID } from "crypto";
import { router, publicProcedure } from "../lib/trpc";
import cyberwords from "../lib/cyberwords";
import words from "../lib/words";
import { compareStrings } from "@/lib/word";

const CYBERWORD_SET = new Set(
  cyberwords.words.map((word) => word.toLowerCase()),
);
const AVAILABLE_WORDS = Array.from(CYBERWORD_SET).filter(
  (word) => word.length === 5,
);

type ActiveGame = {
  word: string;
  createdAt: number;
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

export const feriacienciaRouter = router({
  startGame: publicProcedure.mutation(() => {
    const word = getRandomWord();
    const gameId = randomUUID();

    activeGames.set(gameId, {
      word,
      createdAt: Date.now(),
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
          // Remove completed games to avoid leaks
          activeGames.delete(input.gameId);
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
});
