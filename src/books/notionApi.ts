import { Client } from "@notionhq/client";
import type {
  CreatePageResponse,
  PageObjectResponse,
  CreateDatabaseResponse,
  CreateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { LogLevel } from "@notionhq/client/build/src/logging";
import { BookData } from "./types";

type BooksDatabaseProperties = CreateDatabaseParameters["properties"];
// type BookDatabasePropertyValues =
//   CreateDatabaseParameters["properties"][keyof CreateDatabaseParameters["properties"]];

const booksDbCreatePropsSchema: BooksDatabaseProperties = {
  Title: {
    ...asCreateType("title"),
    description: "Title",
  },
  ID: asCreateType("unique_id"),
  ISBN: asCreateType("rich_text"),
  Author: asCreateType("rich_text"),
  CoverImage: asCreateType("url"),
  Publisher: asCreateType("rich_text"),
  PublishedDate: asCreateType("date"),
  Summary: asCreateType("rich_text"),
  Note: asCreateType("rich_text"),
};

// add more as https://github.com/makenotion/notion-sdk-js/blob/main/src/api-endpoints.ts#L11442
// node_modules/@notionhq/client/build/src/api-endpoints.d.ts
function asCreateType(kind: string) {
  switch (kind) {
    case "title":
      return {
        title: {},
        type: kind,
      } as const;
    case "rich_text":
      return {
        rich_text: {},
        type: kind,
      } as const;
    case "unique_id":
      return {
        unique_id: { prefix: null },
        type: kind,
      } as const;
    case "date":
      return {
        date: {},
        type: kind,
      } as const;
    case "url":
      return {
        url: {},
        type: kind,
      } as const;
    case "files":
      return {
        files: {},
        type: kind,
      } as const;
    default:
      throw new Error(`Unsupported type: ${kind}`);
  }
}

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
    // cover: page.cover,
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
    // https://developers.notion.com/reference/property-value-object#title-property-values
    case "title":
      // todo should use type field
      return val.map((item: any) => item.text.content).join("; ");
    case "rich_text":
      // todo should use type field
      return val.map((item: any) => item.text.content).join("; ");
    case "url":
      return val;
    case "date":
      return parseDate(val?.start);
    case "unique_id":
      return val.number;
    default:
      return val;
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
      // body failed validation: body.properties.PublishedDate.date.start should be a valid ISO 8601 date string, instead was `"2013-3"`
      // validate value is valid date string and format it properly in ISO 8601 format
      return {
        date: {
          start: new Date(value).toISOString().split("T")[0],
        },
      };
    default:
      throw new Error(`Unsupported type: ${kind}`);
  }
}

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

interface ItemProcessor {
  (item: any, idx: number): Promise<void>;
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

  async pagingHandle({
    databaseId,
    action,
    limit = 100,
    pageSize = 10,
    startCursor = undefined,
    pageSleepMs = 800,
  }: {
    databaseId: string;
    action: ItemProcessor;
    limit?: number;
    pageSize?: number;
    startCursor?: string;
    pageSleepMs?: number;
  }): Promise<void> {
    let hasMore = true;
    let nextCursor: string | undefined = startCursor;
    let handledCount = 0;
    let itemsPageIndex = 0;
    try {
      while (hasMore && handledCount < limit) {
        itemsPageIndex++;
        const queryInfo = {
          database_id: databaseId,
          start_cursor: nextCursor,
          page_size: pageSize,
        };
        console.info(
          `Processing page ${itemsPageIndex} with start_cursor: ${JSON.stringify(
            queryInfo,
            null,
            2
          )}`
        );
        const response = await this.client.databases.query({
          ...queryInfo,
          sorts: [
            {
              timestamp: "created_time",
              direction: "ascending",
            },
          ],
        });

        let results = response.results;
        const remaining = limit - handledCount;
        if (results.length > remaining) {
          results = results.slice(0, remaining);
        }

        for (const page of results) {
          const pageObj = getPageInfo(page as PageObjectResponse);
          await action(pageObj, handledCount);
          handledCount++;
        }

        if (handledCount >= limit) break;

        // https://developers.notion.com/reference/request-limits#rate-limits
        // As Notion docs say, Notion starts rate limiting beyond 3 requests per second. I have added throttling to this tool in the latest revision.
        if (pageSleepMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, pageSleepMs));
        }
        hasMore = response.has_more;
        nextCursor = response.next_cursor || undefined;
      }
    } catch (error) {
      console.error("Error fetching or processing pages:", error);
    }
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

  async createBookPage(
    databaseId: string,
    bookData: BookData,
    checkExist = true
  ) {
    if (checkExist) {
      console.info(`check if book-page exists: ${bookData.isbn}`);
      const existingPage = await this.findPrettyBookPageByISBN(
        bookData.isbn,
        databaseId
      );
      if (existingPage) {
        console.info(
          `found book-page exists: ${bookData.isbn} at ${existingPage.url}`
        );
        return existingPage;
      }
    }

    const properties = bookDataToBookPageProps(bookData);

    let createParams = {
      parent: {
        database_id: databaseId,
      },
      properties,
    };

    if (bookData.img) {
      createParams = {
        ...createParams,
        cover: {
          type: "external",
          external: {
            url: bookData.img,
          },
        },
      };
    }
    const pageResp = await this.client.pages.create(createParams);
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
