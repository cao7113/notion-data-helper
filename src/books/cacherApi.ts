import { RespData, TsBookResp, BookInfoProvider } from "./types";

const apiUrl = process.env.CACHER_API_URL || "https://api-cache.fly.dev";

export default class CacherApi implements BookInfoProvider {
  #authKey?: string;
  verbose: boolean = true;

  public constructor(authKey?: string, verbose: boolean = false) {
    this.#authKey = authKey;
    this.verbose = verbose;
  }

  async getBookInfo(isbn: string): Promise<RespData> {
    const url = `${apiUrl}/tanshu/isbn/${isbn}`;

    const headers: HeadersInit = {
      accept: "application/json",
    };

    if (this.#authKey) {
      headers["Authorization"] = `Bearer ${this.#authKey}`;
    }

    if (this.verbose) {
      console.log(`Fetching ${url.replace(this.#authKey || "", "xxx")}`);
    }

    try {
      const resp = await fetch(url, { headers });

      if (!resp.ok) {
        if (this.verbose) {
          console.error(JSON.stringify(resp, null, 2));
        }
        return {
          ok: false,
          error: `Failed to fetch book with ISBN ${isbn}: ${resp.status} ${resp.statusText}`,
          data: null,
        };
      }

      const data: TsBookResp = await resp.json();
      if (data.code !== 1) {
        return {
          ok: false,
          error: `API error: ${data.msg}`,
          data: null,
        };
      }

      return {
        ok: true,
        error: null,
        data: data.data,
      };
    } catch (error) {
      if (this.verbose) {
        console.error(`Error fetching book with ISBN ${isbn}:`, error);
      }
      return {
        ok: false,
        error: `Exception occurred: ${
          error instanceof Error ? error.message : String(error)
        }`,
        data: null,
      };
    }
  }
}
