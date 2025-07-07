import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { todoRouter } from "./todo";
import { wordRouter } from "./word";

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
});
export type AppRouter = typeof appRouter;
