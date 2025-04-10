import { describe, it, expect, afterEach, vi } from "vitest";
import { app } from "./index";
import NotionApi from "./notionApi";
import CacherApi from "./cacherApi";
import demoBookPage from "../../test/demo-book-page.json";
import bookPagesResp from "../../test/notion-book-pages-resp.json";
import tsDemoBookResp from "../../test/cacher-demo-isbn-resp.json";
import {
  // bookDataToBookPageProps,
  getPagePropItemValue,
  getPageInfo,
} from "./notionApi";
import type {
  // CreatePageResponse,
  PageObjectResponse,
  // CreateDatabaseResponse,
  // CreateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";

const mockBookPages = [demoBookPage];
const firstBookPage = bookPagesResp.results[0];
const firstPrettyBookPage = getPageInfo(firstBookPage as PageObjectResponse);
const firstBookPageISBN = getPagePropItemValue(firstBookPage, "ISBN");
const tsBookData = tsDemoBookResp.data;

// load envs
it("should loaded test envs", async () => {
  // console.log(process.env.NOTION_API_KEY);
  expect(process.env.NOTION_API_KEY).toEqual("test-notion-key");
});
const testDbId = process.env.NOTION_DATABASE_ID!;

describe("Books API Routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return welcome message", async () => {
    const resp = await app.request("/hi", { method: "GET" });
    expect(resp.status).toBe(200);
    const data: { msg: string } = await resp.json();
    expect(data.msg).toBe("Welcome to books!");
  });

  it("should list book pages", async () => {
    const listSpy = vi
      .spyOn(NotionApi.prototype, "listBookPages")
      .mockResolvedValue(mockBookPages);
    const resp = await app.request(`/?limit=1&databaseId=${testDbId}`, {
      method: "GET",
    });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toEqual(mockBookPages);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith(testDbId, 1);
  });

  it("should get book page by valid ISBN", async () => {
    const findPrettySpy = vi
      .spyOn(NotionApi.prototype, "findPrettyBookPageByISBN")
      .mockResolvedValue(demoBookPage);
    const resp = await app.request(
      `/isbn/9787115424914?databaseId=${testDbId}`,
      { method: "GET" }
    );
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toEqual(demoBookPage);
    expect(findPrettySpy).toHaveBeenCalledTimes(1);
    expect(findPrettySpy).toHaveBeenCalledWith("9787115424914", testDbId);
  });

  it("should return 404 for a non-existing book on GET", async () => {
    const findPrettySpy = vi
      .spyOn(NotionApi.prototype, "findPrettyBookPageByISBN")
      .mockResolvedValue(null);
    const resp = await app.request(
      `/isbn/9787115424914?databaseId=${testDbId}`,
      { method: "GET" }
    );
    expect(resp.status).toBe(404);
    const data: { error: string } = await resp.json();
    expect(data.error).toBe("Book not found");
    expect(findPrettySpy).toHaveBeenCalledTimes(1);
    expect(findPrettySpy).toHaveBeenCalledWith("9787115424914", testDbId);
  });

  it("should return existing book message on create if book already exists", async () => {
    const findSpy = vi
      .spyOn(NotionApi.prototype, "findBookPageByISBN")
      .mockResolvedValue(firstBookPage);
    const tsSpy = vi.spyOn(CacherApi.prototype, "getBookInfo");
    const createSpy = vi.spyOn(NotionApi.prototype, "createBookPage");

    const resp = await app.request(
      `/isbn/9787115424914?databaseId=${testDbId}`,
      { method: "POST" }
    );
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toEqual(firstPrettyBookPage);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(tsSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("should create a book page for a valid ISBN when it does not exist", async () => {
    const findSpy = vi
      .spyOn(NotionApi.prototype, "findBookPageByISBN")
      .mockResolvedValue(null);
    const tsSpy = vi
      .spyOn(CacherApi.prototype, "getBookInfo")
      .mockResolvedValue({ ok: true, data: tsBookData, error: null });
    const createSpy = vi
      .spyOn(NotionApi.prototype, "createBookPage")
      .mockResolvedValue(firstBookPage);

    const resp = await app.request(
      `/isbn/9787115424914?databaseId=${testDbId}`,
      { method: "POST" }
    );
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toEqual(firstBookPage);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(tsSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(tsSpy).toHaveBeenCalledWith("9787115424914");
    expect(createSpy).toHaveBeenCalledWith(testDbId, tsBookData);
  });

  it("should return 404 when creating a book page for an invalid ISBN", async () => {
    const findSpy = vi
      .spyOn(NotionApi.prototype, "findBookPageByISBN")
      .mockResolvedValue(null);
    const tsSpy = vi
      .spyOn(CacherApi.prototype, "getBookInfo")
      .mockResolvedValue({ ok: false, data: null, error: "Remote error" });
    const createSpy = vi.spyOn(NotionApi.prototype, "createBookPage");

    const resp = await app.request(
      `/isbn/9787115424914?databaseId=${testDbId}`,
      { method: "POST" }
    );
    expect(resp.status).toBe(404);
    const data = await resp.json();
    expect(data).toEqual({ error: "Remote book not found or API error" });
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(tsSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
