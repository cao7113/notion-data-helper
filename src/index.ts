import { Hono } from "hono";
import { Client } from "@notionhq/client";
import { TanshuApi } from "./tanshuApi";
import { NotionApi } from "./notionApi";

// read envs
const tanshuApiKey = process.env.TANSHU_API_KEY!;
const notionApiKey = process.env.NOTION_API_KEY!;
const notionDatabaseId = process.env.NOTION_DATABASE_ID!;

const app = new Hono();
const notion = new NotionApi(notionApiKey);

app.get("/", (ctx) => {
  return ctx.json({
    message: "Hello booker, only /isbn/:isbn available now!",
  });
});

app.post("/isbn/:isbn", async (ctx) => {
  const isbn = ctx.req.param("isbn");
  if (!isbn) {
    return ctx.json({ error: "ISBN path param is required" }, 400);
  }

  // check if book already exist
  const check = await notion.isBookExists(isbn, notionDatabaseId);
  if (check) {
    return ctx.json({ error: "Book already exists" }, 409);
  }

  try {
    const bookData = await TanshuApi.getBookInfo(isbn, tanshuApiKey);

    if (!bookData) {
      return ctx.json({ error: "Book not found or API error" }, 404);
    }

    const page = await notion.createBookPage(notionDatabaseId, bookData);
    return ctx.json({
      message: `Book added to Notion successfully with url ${page.url}`,
    });
  } catch (error) {
    console.error("Error:", error);
    return ctx.json(
      { error: "An error occurred while processing your request" },
      500
    );
  }
});

export default app;
