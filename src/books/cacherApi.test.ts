import { describe, expect, test, vi } from "vitest";
import CacherApi from "./cacherApi";
import tsDemoBookResp from "../../test/cacher-demo-isbn-resp.json";

describe("CacherApi", () => {
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

  test("should fetch isbn info successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tsDemoBookResp,
    });

    const api = new CacherApi("test-auth-key");
    const isbn = "9781234567890";
    const bookInfo = await api.getBookInfo(isbn);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api-cache.fly.dev/tanshu/isbn/${isbn}`,
      {
        headers: {
          Authorization: "Bearer test-auth-key",
          accept: "application/json",
        },
      }
    );
    expect(bookInfo.data).toEqual(tsDemoBookResp.data);
  });

  test("should throw an error if fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "Invalid ISBN format" }),
    });

    const api = new CacherApi("test-auth-key", true);
    const isbn = "9781234567890";

    const data = await api.getBookInfo(isbn);
    expect(data).toEqual({
      data: null,
      error: `Failed to fetch book with ISBN ${isbn}: 400 Bad Request`,
      ok: false,
    });
  });
});
