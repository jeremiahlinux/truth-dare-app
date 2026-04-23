import type { IncomingMessage, ServerResponse } from "node:http";

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

let cachedHandler: RequestHandler | null = null;

async function getHandler(): Promise<RequestHandler> {
  if (cachedHandler) {
    return cachedHandler;
  }

  const [{ createHTTPHandler }, { appRouter }, { createContext }] = await Promise.all([
    import("@trpc/server/adapters/standalone"),
    import("../../server/routers.js"),
    import("../../server/_core/context.js"),
  ]);

  cachedHandler = createHTTPHandler({
    router: appRouter,
    basePath: "/api/trpc/",
    createContext: async ({ req, res }) =>
      createContext({
        req: req as any,
        res: res as any,
      }),
  });

  return cachedHandler;
}

export default async function trpcHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    const handler = await getHandler();
    return handler(req, res);
  } catch (error) {
    console.error("[tRPC API bootstrap error]", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
