import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { todoRouter } from "./todo";
import { wordRouter } from "./word";
import { feriacienciaRouter } from "./feriaciencia";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  todo: todoRouter,
  word: wordRouter,
  feriaciencia: feriacienciaRouter,
});
export type AppRouter = typeof appRouter;
