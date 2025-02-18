import { BookData } from "./bookData";

interface TanshuApiResponse {
  code: number;
  msg: string;
  data: BookData;
}

export class TanshuApi {
  private static apiUrl = "https://api.tanshuapi.com/api/isbn_base/v1/index";

  static async getBookInfo(
    isbn: string,
    key: string
  ): Promise<BookData | null> {
    const response = await fetch(`${TanshuApi.apiUrl}?isbn=${isbn}&key=${key}`);
    console.log(`Fetching ${TanshuApi.apiUrl}?isbn=${isbn}&key=`);

    if (!response.ok) {
      throw new Error(`Failed to fetch book info for ISBN ${isbn}`);
    }

    const data: TanshuApiResponse = await response.json();

    if (data.code !== 1) {
      throw new Error(`API Error: ${data.msg}`);
    }

    return data.data;
  }
}

//  {
//   "code": 1,
//   "msg": "操作成功",
//   "data": {
//     "title": "图解密码技术"
//   }
//  }
