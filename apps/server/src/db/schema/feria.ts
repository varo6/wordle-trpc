import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const feriaGameStats = sqliteTable("feria_game_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  completedGames: integer("completed_games").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
});

export const feriaWordStats = sqliteTable("feria_word_stats", {
  word: text("word").primaryKey(),
  correctGuesses: integer("correct_guesses").notNull().default(0),
  incorrectGuesses: integer("incorrect_guesses").notNull().default(0),
});
