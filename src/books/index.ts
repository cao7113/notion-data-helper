import type { JwtVariables } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import { env } from "hono/adapter";

// NOTE: The z object should be imported from @hono/zod-openapi other than from hono
import { z, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import NotionApi from "./notionApi";
import CacherApi from "./cacherApi";

// Specify the variable types to infer the `c.get('jwtPayload')`:
type Variables = JwtVariables;

const addClients = createMiddleware(async (c, next) => {
  const envs = env(c);
  // console.log("envs", envs);
  const notionClient = new NotionApi(envs.NOTION_API_KEY);
  const cacherClient = new CacherApi(envs.CACHER_BEARER_AUTH_TOKEN);
  c.set("notionClient", notionClient);
  c.set("cacherClient", cacherClient);

  await next();
});

const BookPageSchema = z
  .object({
    id: z.string().openapi({
      example: "1b2673e5-9ab6-817a-99b9-fccf8e27d06d",
    }),
    created_time: z.string().openapi({
      example: "2025-03-10T03:39:00.000Z",
    }),
    last_edited_time: z.string().openapi({
      example: "2025-03-10T03:39:00.000Z",
    }),
    url: z.string().url().openapi({
      example: "https://www.notion.so/1b2673e59ab6817a99b9fccf8e27d06d",
    }),
    properties: z.object({
      PublishedDate: z.string().openapi({
        example: "2016-06-01",
      }),
      Note: z.string().openapi({
        example: "",
      }),
      Summary: z.string().openapi({
        example:
          "本书以图配文的形式，详细讲解了6种重要的密码技术：对称密码、公钥密码、单向散列函数、消息认证码、数字签名和伪*数生成器。",
      }),
      Publisher: z.string().openapi({
        example: "人民邮电出版社",
      }),
      Author: z.string().openapi({
        example: "结城浩",
      }),
      ISBN: z.string().openapi({
        example: "9787115424914",
      }),
      CoverImage: z.string().openapi({
        example:
          "http://static1.showapi.com/app2/isbn/imgs/72868dd64dcd404e92f19d6f21ee9c71.jpg",
      }),
      Title: z.string().openapi({
        example: "图解密码技术",
      }),
    }),
  })
  .openapi("BookPage");

const BookPageListSchema = z.array(BookPageSchema).openapi("BookPageList");

const DbIdSchema = z
  .string()
  .min(32)
  .openapi({
    param: {
      name: "databaseId",
      in: "query",
    },
    example:
      process.env.NOTION_DATABASE_ID || "1c4673e59ab6818e97c3db3941ad1135",
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
          databaseId: DbIdSchema,
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
          content: {
            "application/json": {
              schema: BookPageListSchema,
            },
          },
        },
      },
    }),
    async (c) => {
      const { limit, databaseId } = c.req.valid("query");
      const notionClient: NotionApi = c.get("notionClient");
      const pages = await notionClient.listBookPages(databaseId, limit);
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
        query: z.object({
          databaseId: DbIdSchema,
        }),
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
          content: {
            "application/json": {
              schema: BookPageSchema,
            },
          },
        },
      },
    }),
    async (c) => {
      const { isbn } = c.req.valid("param");
      const { databaseId } = c.req.valid("query");
      const notionClient: NotionApi = c.get("notionClient");

      const found = await notionClient.findPrettyBookPageByISBN(
        isbn,
        databaseId
      );
      if (found) {
        console.log(`Book found at ${found?.url}`);
        return c.json(found);
      }

      const cacherClient = c.get("cacherClient");
      const bookInfo = await cacherClient.getBookInfo(isbn);
      if (!bookInfo.ok) {
        return c.json({ error: "Remote book not found or API error" }, 404);
      }

      const bookData = bookInfo.data;
      const page = await notionClient.createBookPage(databaseId, bookData);
      return c.json(page);
    }
  )
  // get book-page
  .openapi(
    createRoute({
      tags: ["Books"],
      summary: "Get book by ISBN",
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
        query: z.object({
          databaseId: DbIdSchema,
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
          content: {
            "application/json": {
              schema: BookPageSchema,
            },
          },
        },
      },
    }),
    async (c) => {
      const { databaseId } = c.req.valid("query");
      const { isbn } = c.req.valid("param");
      const notionClient: NotionApi = c.get("notionClient");
      const bookPage = await notionClient.findPrettyBookPageByISBN(
        isbn,
        databaseId
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
          content: {
            "application/json": {
              schema: z.object({
                message: z.literal("Welcome to books!"),
              }),
            },
          },
        },
      },
    }),
    async (c) => {
      return c.json({ msg: "Welcome to books!" });
    }
  );

export default app;
