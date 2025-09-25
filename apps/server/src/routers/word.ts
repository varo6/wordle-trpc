import z from "zod/v4";
import { router, publicProcedure } from "../lib/trpc";
import { todo } from "../db/schema/todo";
import { eq } from "drizzle-orm";
import { db } from "../db";
import words from "../lib/words";
import { getCurrentWord, getTodaysWord, clearWordCache } from "../lib/today";
import { compareStrings } from "@/lib/word";

const serverResponse = z.object({
  isValid: z.boolean(),
  isCorrect: z.boolean(),
  result: z.array(
    z.union([z.literal("ok"), z.literal("almost"), z.literal("no")]),
  ),
});

export const wordRouter = router({
  getTodays: publicProcedure.query(async () => {
    return await db.select().from(todo);
  }),

  getTodaysWord: publicProcedure.query(() => {
    return getCurrentWord();
  }),

  testWordRotation: publicProcedure.query(() => {
    const seed = process.env.WORD_SEED || "semilla";
    const today = getCurrentWord();

    // Get current time in Madrid timezone
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
    );

    return {
      today: today,
      currentTime: now.toISOString(),
      madridTime: now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
      wordSeed: seed,
      cacheStatus: "Word is cached until next day (00:00 Madrid time)",
    };
  }),

  clearCache: publicProcedure.mutation(() => {
    clearWordCache();
    return { success: true, message: "Word cache cleared" };
  }),

  timeToEpoch: publicProcedure.query(() => {
    // Get current time in Madrid timezone
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
    );

    // Calculate next midnight (00:00) in Madrid timezone
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0); // Set to next day at 00:00

    // Calculate minutes until next midnight
    const minutesUntilEpoch = Math.floor(
      (nextMidnight.getTime() - now.getTime()) / (1000 * 60),
    );

    return minutesUntilEpoch;
  }),

  tryWord: publicProcedure
    .input(z.string())
    .mutation(async ({ input: guess }) => {
      guess = guess.toLowerCase();
      console.log(guess);

      // Get today's word dynamically
      const today = getCurrentWord();

      // Create response object
      const response = {
        isValid: false,
        isCorrect: false,
        result: Array(guess.length).fill("no") as ("ok" | "almost" | "no")[],
      };

      // Check if the word is valid
      if (words.words.includes(guess)) {
        response.isValid = true;

        // Get comparison result
        const result = compareStrings(today, guess);
        response.result = result;

        // Check if the word is correct
        if (guess === today) {
          response.isCorrect = true;
        }
      }

      console.log(response.isValid);
      return response;
    }),
});
