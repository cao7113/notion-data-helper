import { logger } from "hono/logger";
import { timing, setMetric, startTime, endTime } from "hono/timing";
// import { jwt } from "hono/jwt";
import type { JwtVariables } from "hono/jwt";
import { env, getRuntimeKey } from "hono/adapter";
// NOTE: The z object should be imported from @hono/zod-openapi other than from hono
import { z, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
// import { serve } from "@hono/node-server";

import { version } from "../package.json";
import { bearerMiddleware } from "./auth";
import books from "./books/index";

const app = new OpenAPIHono<{
  // Specify the variable types to infer the `c.get('jwtPayload')`:
  Variables: JwtVariables;
  Bindings: CloudflareBindings;
}>();

app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
});
// app.openAPIRegistry.registerComponent("securitySchemes", "JWT", {
//   type: "http",
//   scheme: "bearer",
//   bearerFormat: "JWT",
// })

app.use(logger(), timing());

app.use("/books/*", bearerMiddleware);
app.route("/books", books);

app
  // ping-pong
  .openapi(
    createRoute({
      tags: ["Tools"],
      summary: "Ping Pong",
      method: "get",
      path: "/ping",
      request: {},
      responses: {
        200: {
          description: "Success message",
          content: {
            "application/json": {
              schema: z.object({
                message: z.literal("Pong"),
              }),
            },
          },
        },
      },
    }),
    (c) => {
      return c.json({
        message: "Pong",
      });
    }
  )
  // timing-test
  .openapi(
    createRoute({
      tags: ["Tools"],
      summary: "timing delay test",
      method: "get",
      path: "/timing",
      request: {
        query: z.object({
          delay: z.coerce
            .number()
            .int()
            .min(0)
            .max(60000)
            .default(5)
            .openapi({
              param: {
                name: "delay",
                in: "query",
              },
              example: 5,
              default: 5,
            }),
        }),
      },
      responses: {
        200: {
          description: "Success message",
        },
      },
    }),
    async (c) => {
      // Cloudflare Free Plan: 10ms CPU time per request.
      const { delay } = c.req.valid("query");
      await new Promise((resolve) => setTimeout(resolve, delay));
      return c.json({
        msg: `delay ${delay} ms`,
        delay: delay,
      });
    }
  )
  // env-test
  .openapi(
    createRoute({
      tags: ["Tools"],
      summary: "ENV test",
      method: "get",
      path: "/envs",
      request: {},
      security: [
        {
          Bearer: [],
        },
      ],
      middleware: bearerMiddleware,
      responses: {
        200: {
          description: "Success message",
        },
      },
    }),
    (c) => {
      // https://hono.dev/docs/helpers/adapter
      // NAME is process.env.NAME on Node.js or Bun
      // NAME is the value written in `wrangler.toml` on Cloudflare
      const { TEST_ONLY_ENV } = env<{ TEST_ONLY_ENV: string }>(c);
      return c.json({
        TEST_ONLY_ENV,
        runtime: getRuntimeKey(),
        test_only_env: TEST_ONLY_ENV,
      });
    }
  )
  // bad mock
  .openapi(
    createRoute({
      tags: ["Tools"],
      summary: "Mock bad request",
      method: "get",
      path: "/bad",
      request: {
        query: z.object({
          code: z.coerce
            .number()
            .int()
            .min(400)
            .max(499)
            .default(400)
            .openapi({
              param: {
                name: "code",
                in: "query",
              },
              example: 400,
              default: 400,
            }),
        }),
      },
      security: [
        {
          Bearer: [],
        },
      ],
      middleware: bearerMiddleware,
      responses: {
        200: {
          description: "Success message",
        },
        400: {
          description: "Error message",
        },
      },
    }),
    (c) => {
      const { code } = c.req.valid("query");

      return c.json(
        {
          error: `Bad request code=${code}`,
        },
        { status: code }
      );
    }
  );

// https://swagger.io/specification/
app.doc31("/openapi", (c) => {
  let origin = new URL(c.req.url).origin;
  if (origin.includes(".fly.dev") && origin.startsWith("http://")) {
    origin = origin.replace("http://", "https://");
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Notion Data Helper API Docs",
      version: version,
      // https://spec.commonmark.org/0.31.2/#links
      description: `
        More: 
        - [Github](https://github.com/cao7113/notion-data-helper)
        - [Hono Zod OpenAPI](https://hono.dev/examples/zod-openapi)
      `,
    },
    servers: [
      {
        url: origin,
        description: "Current",
      },
    ],
  };
});

const sui = swaggerUI({
  url: "/openapi",
  title: "API Docs",
  // https://github.com/honojs/middleware/blob/main/packages/swagger-ui/README.md#options
  manuallySwaggerUIHtml: (asset) => `
    <div>
      <div id="swagger-ui"></div>
      ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`)}
      ${asset.js.map(
        (url) => `<script src="${url}" crossorigin="anonymous"></script>`
      )}
      <script>
        window.ui = SwaggerUIBundle({
          url: "/openapi",
          dom_id: "#swagger-ui",
          presets: [SwaggerUIBundle.presets.apis],
          requestInterceptor: (request) => {
            if (window.location.href.startsWith("http://localhost") || window.location.href.startsWith("http://192.168.1.") ) {
              request.headers["Authorization"] = "Bearer ${
                process.env.BEARER_AUTH_TOKEN
              }";
            }
            return request;
          },
        });
      </script>
    </div>
  `,
});
app.get("/", sui);

// console.log(JSON.stringify(app, null, 2));
const runtime = getRuntimeKey();
console.log(`App Version: ${version} on Runtime: ${runtime}`);

let finalApp;

switch (runtime) {
  case "bun":
    const port = process.env.FLY_APP_NAME
      ? Number(process.env.PORT ?? 8080)
      : 3000;
    // https://hono.dev/docs/getting-started/bun#change-port-number
    finalApp = {
      fetch: app.fetch,
      idleTimeout: 30, // idle timeout in seconds
      port: port,
    };
    break;
  case "workerd": // production
    // https://chatgpt.com/c/67d0dd7c-d22c-8003-bc8b-db6b9037cbe3
    finalApp = app;
    break;
  case "node": // test in node by vitest
    // https://hono.dev/docs/getting-started/nodejs
    // finalApp = serve({
    //   fetch: app.fetch,
    //   port: 3000,
    // });
    finalApp = app;
    break;
  default:
    throw new Error(`Unsupported runtime: ${runtime}`);
}

export default finalApp;
