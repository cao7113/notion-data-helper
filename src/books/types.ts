export interface BookData {
  title: string;
  author: string;
  publisher: string;
  pubdate: string;
  summary: string;
  isbn: string;
  img: string;
  pubplace: string;
  pages: string;
  price: string;
  binding: string;
  edition: string;
  format: string;
}

export interface TsApiResponse {
  code: number;
  msg: string;
  data: any;
}

export interface TsBookResp extends TsApiResponse {
  data: BookData;
}

export type RespData = {
  ok: boolean;
  error: string | null;
  data: BookData | null;
};

export interface BookInfoProvider {
  getBookInfo(isbn: string): Promise<any>;
}
