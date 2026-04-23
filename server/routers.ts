import { COOKIE_NAME } from "../shared/const.ts";
import { getSessionCookieOptions } from "./_core/cookies.ts";
import { publicProcedure, router } from "./_core/trpc.ts";
import { gameRouter } from "./routers/gameRouter.ts";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      if (ctx.res?.clearCookie) {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      }
      return {
        success: true,
      } as const;
    }),
  }),
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
