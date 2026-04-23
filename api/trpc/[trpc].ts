import type { IncomingMessage, ServerResponse } from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { appRouter } from "../../server/routers.ts";
import { createContext } from "../../server/_core/context.ts";

const handler = createHTTPHandler({
  router: appRouter,
  basePath: "/api/trpc/",
  createContext: async ({ req, res }) =>
    createContext({
      req: req as any,
      res: res as any,
    }),
});

export default function trpcHandler(req: IncomingMessage, res: ServerResponse) {
  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
