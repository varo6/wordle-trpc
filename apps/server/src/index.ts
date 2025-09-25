import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { auth } from "./lib/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
// parse cors origins from environment variable
const corsorigins = process.env.cors_origin
  ? process.env.cors_origin.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  "/*",
  cors({
    origin: (origin) => {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return origin;

      // check if origin is in allowed list
      return corsorigins.includes(origin) ? origin : null;
    },
    allowMethods: ["get", "post", "put", "delete", "options"],
    allowHeaders: ["content-type", "authorization", "x-requested-with"],
    credentials: true,
  }),
);

app.on(["post", "get"], "/api/auth/**", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("ok");
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
