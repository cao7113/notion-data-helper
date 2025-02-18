import { TanshuApi } from "../src/tanshuApi";

// globalThis 是 JavaScript 中的一个全局对象，它在所有 JavaScript 环境中都可用，且它提供了对当前环境的全局上下文的访问。
// 为什么需要 globalThis？
// 在不同的 JavaScript 环境中（如浏览器、Node.js、Web Worker等），全局对象的名称不同：
// 在 浏览器 中，全局对象通常是 window。
// 在 Node.js 中，全局对象通常是 global。
// 在 Web Worker 中，全局对象是 self。

// 模拟 fetch 请求
globalThis.fetch = async (url: string) => {
  return {
    ok: true,
    json: async () => ({
      code: 1,
      msg: "操作成功",
      data: {
        title: "图解密码技术",
        img: "http://static1.showapi.com/app2/isbn/imgs/72868dd64dcd404e92f19d6f21ee9c71.jpg",
        author: "结城浩",
        isbn: "9787115424914",
        publisher: "人民邮电出版社",
        pubdate: "2016-06",
        pubplace: "",
        pages: "402",
        price: "89.00",
        binding: "平装",
        edition: "",
        format: "16开",
        summary: "本书以图配文的形式，详细讲解了6种重要的密码技术。",
      },
    }),
  };
};

describe("TanshuApi", () => {
  it("should fetch book data for a valid ISBN", async () => {
    const bookData = await TanshuApi.getBookInfo("9787115424914", "test-key");

    expect(bookData).toEqual({
      title: "图解密码技术",
      img: "http://static1.showapi.com/app2/isbn/imgs/72868dd64dcd404e92f19d6f21ee9c71.jpg",
      author: "结城浩",
      isbn: "9787115424914",
      publisher: "人民邮电出版社",
      pubdate: "2016-06",
      pubplace: "",
      pages: "402",
      price: "89.00",
      binding: "平装",
      edition: "",
      format: "16开",
      summary: "本书以图配文的形式，详细讲解了6种重要的密码技术。",
    });
  });

  it("should throw an error if the API response is not successful", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ code: 0, msg: "Invalid ISBN", data: null }),
    });

    try {
      await TanshuApi.getBookInfo("invalid-isbn", "test-key");
      expect(true).toBe(false); // This line should not be reached if an error is thrown
    } catch (error) {
      expect(error.message).toBe("API Error: Invalid ISBN");
    }
  });

  it("should throw an error if the fetch request fails", async () => {
    globalThis.fetch = async () => {
      throw new Error("Network error");
    };

    try {
      await TanshuApi.getBookInfo("9787115424914", "test-key");
      expect(true).toBe(false); // This line should not be reached if an error is thrown
    } catch (error) {
      expect(error.message).toBe(
        // "Failed to fetch book info for ISBN 9787115424914"
        "Network error"
      );
    }
  });
});
