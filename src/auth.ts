import { bearerAuth } from "hono/bearer-auth";
import { createMiddleware } from "hono/factory";
import { env, getRuntimeKey } from "hono/adapter";

export const bearerMiddleware = createMiddleware(async (c, next) => {
  const envs = env(c);
  const token = envs.BEARER_AUTH_TOKEN;
  if (!token) {
    return c.json({ error: "Invalid bearer token!" }, 401);
  }

  const runNext = bearerAuth({
    token,
  });
  await runNext(c, next);
});

// const jwtMiddleware = createMiddleware(async (c, next) => {
//   const jwtSecret = c.env.JWT_SECRET;
//   if (!jwtSecret) {
//     return c.json({ error: "JWT secret not configured." }, 500);
//   }
//   jwt({
//     secret: jwtSecret,
//   });
//   await next();
// });
