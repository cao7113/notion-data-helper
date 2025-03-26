import { Client } from "@notionhq/client";
import type {
  CreatePageResponse,
  PageObjectResponse,
  CreateDatabaseResponse,
  CreateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { LogLevel } from "@notionhq/client/build/src/logging";
import { BookData } from "./bookData";

type BooksDatabaseProperties = CreateDatabaseParameters["properties"];
// type BookDatabasePropertyValues =
//   CreateDatabaseParameters["properties"][keyof CreateDatabaseParameters["properties"]];

const booksDbCreatePropsSchema: BooksDatabaseProperties = {
  Title: {
    ...as_type("title"),
    description: "Title",
  },
  ISBN: as_type("rich_text"),
  Author: as_type("rich_text"),
  CoverImage: as_type("url"),
  Publisher: as_type("rich_text"),
  PublishedDate: as_type("date"),
  Summary: as_type("rich_text"),
  Note: as_type("rich_text"),
};

export function getPageInfo(page: PageObjectResponse) {
  const prettyProps = Object.keys(page.properties).reduce((acc, key) => {
    if (booksDbCreatePropsSchema[key]) {
      acc[key] = getPagePropItemValue(page, key);
    }
    return acc;
  }, {} as Record<string, any>);

  return {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    url: page.url,
    properties: prettyProps,
  };
}

// "2016-06-01T00:00:00.000+00:00" 截取日期部分
export function parseDate(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr?.split("T")[0];
}

export function getPagePropItemValue(
  page: { properties: any },
  prop: string
): string {
  const propObj = page.properties[prop];
  const tpValue = propObj["type"];
  const val = propObj[tpValue];
  switch (tpValue) {
    case "title":
      return val.map((item: any) => item.text.content).join("; ");
    case "rich_text":
      return val.map((item: any) => item.text.content).join("; ");
    case "url":
      return val;
    case "date":
      return parseDate(val?.start);
    default:
      return val;
  }
}

function as_type(kind: string) {
  switch (kind) {
    case "title":
      return {
        title: {},
        type: "title",
      } as const;
    case "rich_text":
      return {
        rich_text: {},
        type: "rich_text",
      } as const;
    case "url":
      return {
        url: {},
        type: "url",
      } as const;
    case "date":
      return {
        date: {},
        type: "date",
      } as const;
    // add more as https://github.com/makenotion/notion-sdk-js/blob/main/src/api-endpoints.ts#L11442
    default:
      throw new Error(`Unsupported type: ${kind}`);
  }
}

type FieldMapping = {
  notionProp: string;
  kind: string;
};

// book-data key => book-page prop
const bookFieldMapping: Record<string, FieldMapping> = {
  title: {
    notionProp: "Title",
    kind: "title",
  },
  isbn: {
    notionProp: "ISBN",
    kind: "rich_text",
  },
  author: {
    notionProp: "Author",
    kind: "rich_text",
  },
  img: {
    notionProp: "CoverImage",
    kind: "url",
  },
  publisher: {
    notionProp: "Publisher",
    kind: "rich_text",
  },
  pubdate: {
    notionProp: "PublishedDate",
    kind: "date",
  },
  summary: {
    notionProp: "Summary",
    kind: "rich_text",
  },
};

function toBookPagePropValue(value: any, kind: string) {
  switch (kind) {
    case "title":
      return { title: [{ text: { content: value } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: value } }] };
    case "url":
      return { url: value };
    case "date":
      return { date: { start: value } };
    default:
      throw new Error(`Unsupported type: ${kind}`);
  }
}

// convert tanshu bookData to book-page
export function bookDataToBookPageProps(bookData: BookData) {
  const properties = Object.entries(bookData)
    .filter(([key, value]) => value && bookFieldMapping[key])
    .reduce((acc, [key, value]) => {
      const { notionProp, kind } = bookFieldMapping[key];
      acc[notionProp] = toBookPagePropValue(value, kind);
      return acc;
    }, {} as Record<string, any>);

  return properties;
}

export default class NotionApi {
  client: Client;

  constructor(apiKey: string) {
    this.client = new Client({
      auth: apiKey,
      timeoutMs: 10_000,
      logLevel: LogLevel.INFO,
    });
  }

  async createBooksDb(
    title: string,
    rootPageId: string,
    props: BooksDatabaseProperties = booksDbCreatePropsSchema
  ): Promise<CreateDatabaseResponse> {
    return await this.client.databases.create({
      parent: { page_id: rootPageId, type: "page_id" },
      properties: props,
      title: [{ text: { content: title } }],
      description: [{ text: { content: "Book Store" } }],
    });
  }

  async queryBookPages(databaseId: string, pageSize: number = 10) {
    return await this.client.databases.query({
      database_id: databaseId,
      sorts: [
        {
          timestamp: "last_edited_time",
          direction: "descending",
        },
      ],
      page_size: pageSize,
    });
  }

  async listBookPages(databaseId: string, pageSize: number = 10) {
    const resp = await this.queryBookPages(databaseId, pageSize);

    const prettyPages = resp.results.map((page) => {
      return getPageInfo(page as PageObjectResponse);
    });

    return prettyPages;
  }

  async queryBookPagesByISBN(isbn: string, databaseId: string) {
    return await this.client.databases.query({
      database_id: databaseId,
      filter: {
        property: "ISBN",
        rich_text: {
          equals: isbn,
        },
      },
    });
  }

  async findBookResultsByISBN(isbn: string, databaseId: string) {
    const resp = await this.queryBookPagesByISBN(isbn, databaseId);
    return resp.results;
  }

  async findBookPageByISBN(isbn: string, databaseId: string) {
    const results = await this.findBookResultsByISBN(isbn, databaseId);
    return results[0];
  }

  async findPrettyBookPageByISBN(isbn: string, databaseId: string) {
    const page = await this.findBookPageByISBN(isbn, databaseId);
    if (page) {
      return getPageInfo(page as PageObjectResponse);
    } else {
      return null;
    }
  }

  async hasBook(isbn: string, databaseId: string): Promise<boolean> {
    const results = await this.findBookResultsByISBN(isbn, databaseId);
    return results.length > 0;
  }

  async createBookPage(databaseId: string, bookData: BookData) {
    // first check exist???
    const properties = bookDataToBookPageProps(bookData);
    const pageResp = await this.client.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties,
    });
    return getPageInfo(pageResp as PageObjectResponse);
  }

  async updateBookPage(pageId: string, bookData: BookData) {
    const properties = bookDataToBookPageProps(bookData);
    return await this.client.pages.update({
      page_id: pageId,
      properties,
    });
  }

  async getDb(databaseId: string) {
    const resp = await this.client.databases.retrieve({
      database_id: databaseId,
    });
    return resp;
  }

  async getDbProps(databaseId: string) {
    const resp = await this.getDb(databaseId);
    return resp.properties;
  }
}
