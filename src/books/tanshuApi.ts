import { BookData } from "./bookData";

interface TsApiResponse {
  code: number;
  msg: string;
  data: any;
}

interface TsBookResp extends TsApiResponse {
  data: BookData;
}

type RespData = {
  ok: boolean;
  error: string | null;
  data: BookData | null;
};

const apiUrl = "https://api.tanshuapi.com/api";

export default class TanshuApi {
  #authKey?: string;
  verbose: boolean = false;

  public constructor(authKey?: string, verbose: boolean = false) {
    this.#authKey = authKey;
    this.verbose = verbose;
  }

  async getBookInfo(isbn: string): Promise<RespData> {
    const url = `${apiUrl}/isbn_base/v1/index?isbn=${isbn}&key=${
      this.#authKey
    }`;

    const resp = await fetch(url);
    if (this.verbose) {
      console.log(`Fetching ${apiUrl}/isbn_base/v1/index?isbn=${isbn}&key=xxx`);
    }
    if (!resp.ok) {
      if (this.verbose) {
        console.error(JSON.stringify(resp, null, 2));
      }
      return {
        ok: false,
        error: `Failed to fetch remote-book ISBN ${isbn}`,
        data: null,
      };
    }
    const data: TsBookResp = await resp.json();
    if (data.code !== 1) {
      return {
        ok: false,
        error: `Failed to fetch remote-book ISBN ${data.msg}`,
        data: null,
      };
    }
    // console.log(JSON.stringify(data, null, 2));
    return {
      ok: true,
      error: null,
      data: data.data,
    };
  }
}
