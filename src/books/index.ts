import type { JwtVariables } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import { env } from "hono/adapter";

// NOTE: The z object should be imported from @hono/zod-openapi other than from hono
import { z, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import TanshuApi from "./tanshuApi";
import NotionApi from "./notionApi";

// Specify the variable types to infer the `c.get('jwtPayload')`:
type Variables = JwtVariables;

const addClients = createMiddleware(async (c, next) => {
  const envs = env(c);
  // console.log("envs", envs);
  const notionClient = new NotionApi(envs.NOTION_API_KEY);
  const tsClient = new TanshuApi(envs.TANSHU_API_KEY);
  c.set("notionClient", notionClient);
  c.set("tsClient", tsClient);
  c.set("current-db-id", envs.NOTION_DATABASE_ID);
  await next();
});

export const app = new OpenAPIHono<{
  Variables: Variables;
  Bindings: CloudflareBindings;
}>()
  // list books
  .openapi(
    createRoute({
      summary: "List latest books",
      tags: ["Books"],
      method: "get",
      path: "/",
      request: {
        query: z.object({
          limit: z.coerce
            .number()
            .int()
            .min(1)
            .default(5)
            .openapi({
              param: {
                name: "limit",
                in: "query",
              },
              example: 5,
            }),
        }),
      },
      security: [
        {
          Bearer: [],
        },
      ],
      middleware: [addClients],
      responses: {
        200: {
          description: "Success message",
        },
      },
    }),
    async (c) => {
      // console.log("c.req.valid('query')", c.req.valid("query"));
      const { limit } = c.req.valid("query");
      const notionClient: NotionApi = c.get("notionClient");
      const notionDatabaseId = c.get("current-db-id");
      const pages = await notionClient.listBookPages(notionDatabaseId, limit);
      return c.json(pages);
    }
  )
  // create book-page
  .openapi(
    createRoute({
      summary: "Create book by isbn",
      tags: ["Books"],
      method: "post",
      path: "/isbn/{isbn}",
      request: {
        params: z.object({
          isbn: z
            .string()
            .min(10)
            .max(13)
            .openapi({
              param: {
                name: "isbn",
                in: "path",
              },
              example: "9787115424914",
            }),
        }),
      },
      security: [
        {
          Bearer: [],
        },
      ],
      middleware: [addClients],
      responses: {
        200: {
          description: "Success message",
        },
      },
    }),
    async (c) => {
      const { isbn } = c.req.valid("param");
      const notionClient: NotionApi = c.get("notionClient");
      const notionDatabaseId = c.get("current-db-id");
      const found = await notionClient.findBookPageByISBN(
        isbn,
        notionDatabaseId
      );

      if (found) {
        return c.json({ msg: `Book found at ${found?.url}` });
      }

      const tsClient: TanshuApi = c.get("tsClient");
      const bookInfo = await tsClient.getBookInfo(isbn);
      if (!bookInfo.ok) {
        return c.json({ error: "Remote book not found or API error" }, 404);
      }

      const bookData = bookInfo.data;
      const page = await notionClient.createBookPage(
        notionDatabaseId,
        bookData
      );
      return c.json(page);
    }
  )
  // get book-page
  .openapi(
    createRoute({
      tags: ["Books"],
      summary: "Get book by isbn",
      method: "get",
      path: "/isbn/{isbn}",
      request: {
        params: z.object({
          isbn: z
            .string()
            // todo check 10 or 13 digits
            .min(10)
            .max(13)
            .openapi({
              param: {
                name: "isbn",
                in: "path",
              },
              example: "9787115424914",
            }),
        }),
      },
      security: [
        {
          Bearer: [],
        },
      ],
      middleware: [addClients],
      responses: {
        200: {
          description: "Success message",
        },
      },
    }),
    async (c) => {
      const { isbn } = c.req.valid("param");
      const notionClient: NotionApi = c.get("notionClient");
      const notionDatabaseId = c.get("current-db-id");
      const bookPage = await notionClient.findPrettyBookPageByISBN(
        isbn,
        notionDatabaseId
      );
      if (bookPage) {
        return c.json(bookPage);
      } else {
        return c.json({ error: "Book not found" }, 404);
      }
    }
  )
  // welcome
  .openapi(
    createRoute({
      tags: ["Books"],
      summary: "Welcome to books",
      method: "get",
      path: "/hi",
      request: {},
      security: [
        {
          Bearer: [],
        },
      ],
      responses: {
        200: {
          description: "Success message",
        },
      },
    }),
    async (c) => {
      return c.json({ msg: "Welcome to books!" });
    }
  );

export default app;
