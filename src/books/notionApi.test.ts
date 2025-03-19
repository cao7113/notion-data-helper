import { describe, expect, test, vi } from "vitest";
import notionDemoBookPagesResp from "../../test/notion-book-pages-resp.json";
import tsDemoBookResp from "../../test/tanshu-demo-book-resp.json";
import NotionApi from "./notionApi";
import {
  bookDataToBookPageProps,
  getPagePropItemValue,
  getPageInfo,
} from "./notionApi";
import type {
  // CreatePageResponse,
  PageObjectResponse,
  // CreateDatabaseResponse,
  // CreateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { BookData } from "./bookData";

const firstBookPage = notionDemoBookPagesResp.results[0];
const firstPrettyBookPage = getPageInfo(firstBookPage as PageObjectResponse);
const firstBookPageISBN = getPagePropItemValue(firstBookPage, "ISBN");
const invalidISBN = "9780123456789";
const demoBookData: BookData = tsDemoBookResp.data;

vi.mock("@notionhq/client", () => {
  return {
    Client: vi.fn(() => ({
      databases: {
        query: vi.fn().mockImplementation((params) => {
          // console.log(params);
          if (params?.filter?.rich_text?.equals === firstBookPageISBN) {
            return Promise.resolve(notionDemoBookPagesResp);
          } else if (params?.filter?.rich_text?.equals === invalidISBN) {
            return Promise.resolve({ results: [] });
          } else {
            return Promise.resolve(notionDemoBookPagesResp);
          }
        }),
      },
      pages: {
        create: vi.fn().mockImplementation(() => {
          return Promise.resolve(firstBookPage);
        }),
        update: vi.fn().mockImplementation(() => {
          return Promise.resolve(firstBookPage);
        }),
      },
    })),
  };
});

describe("bookDataToBookPageProps", () => {
  test("convert book data to Notion page properties", () => {
    const bookData = demoBookData;
    const bookPageProps = bookDataToBookPageProps(bookData);
    expect(bookPageProps).toEqual({
      Title: { title: [{ text: { content: bookData.title } }] },
      Author: { rich_text: [{ text: { content: bookData.author } }] },
      ISBN: { rich_text: [{ text: { content: bookData.isbn } }] },
      Publisher: { rich_text: [{ text: { content: bookData.publisher } }] },
      PublishedDate: { date: { start: bookData.pubdate } },
      Summary: { rich_text: [{ text: { content: bookData.summary } }] },
      CoverImage: { url: bookData.img },
    });
  });
});

test("ensure sample data defined", () => {
  // console.log(notionDemoBookPagesResp);
  expect(notionDemoBookPagesResp).toBeDefined();
  expect(firstBookPage).toBeDefined();
  expect(firstBookPageISBN).toBeDefined();

  // const data = getPageInfo(firstBookPage);
  // console.log(data);
  expect(firstBookPageISBN).toEqual("9787115424914");
});

describe("query & list book-pages", () => {
  test("list book-pages", async () => {
    const notion = new NotionApi("test-key");
    const resp = await notion.listBookPages("test-database-id");

    const shouldData = [firstPrettyBookPage];
    expect(resp).toEqual(shouldData);
  });
});

describe("query & find book-page", () => {
  test("query response for a valid ISBN", async () => {
    const notion = new NotionApi("test-key");
    const resp = await notion.queryBookPagesByISBN(
      firstBookPageISBN,
      "test-database-id"
    );
    expect(resp).toEqual(notionDemoBookPagesResp);
  });

  test("find book page for a valid ISBN", async () => {
    const notion = new NotionApi("test-key");
    const resp = await notion.findBookPageByISBN(
      firstBookPageISBN,
      "test-database-id"
    );
    expect(resp).toEqual(firstBookPage);
  });

  test("find book page for a invalid ISBN", async () => {
    const notion = new NotionApi("test-key");
    const resp = await notion.findBookPageByISBN(
      invalidISBN,
      "test-database-id"
    );

    expect(resp).toEqual(undefined);
  });
});

describe("create book-page", () => {
  test("ok", async () => {
    const notion = new NotionApi("test-key");
    const resp = await notion.createBookPage("test-database-id", demoBookData);
    expect(resp).toEqual(firstPrettyBookPage);
  });
});

describe("update book-page", () => {
  test("update existing book page", async () => {
    const notion = new NotionApi("test-key");

    const resp = await notion.updateBookPage(firstBookPage.id, demoBookData);
    expect(resp).toEqual(firstBookPage);
  });
});
