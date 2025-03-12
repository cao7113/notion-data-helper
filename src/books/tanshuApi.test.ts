import { describe, expect, test, vi } from "vitest";
import tsDemoBookResp from "../../test/tanshu-demo-book-resp.json";
import TanshuApi from "./tanshuApi";

describe("TanshuApi", () => {
  const mockFetch = vi.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test("should fetch book info successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tsDemoBookResp,
    });

    const api = new TanshuApi("test-auth-key");
    const isbn = "9781234567890";
    const bookInfo = await api.getBookInfo(isbn);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.tanshuapi.com/api/isbn_base/v1/index?isbn=${isbn}&key=test-auth-key`
    );
    expect(bookInfo.data).toEqual(tsDemoBookResp.data);
  });

  test("should throw an error if fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      error: "xxx error",
    });

    const api = new TanshuApi("test-auth-key");
    const isbn = "9781234567890";

    const data = await api.getBookInfo(isbn);
    expect(data).toEqual({
      data: null,
      error: `Failed to fetch remote-book ISBN ${isbn}`,
      ok: false,
    });
  });
});
