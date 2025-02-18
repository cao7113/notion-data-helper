import { Client } from "@notionhq/client";
import type { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { BookData } from "./bookData";

type FieldMapping = {
  notionProp: string;
  converter: (value: any) => any;
};

const bookFieldMapping: Record<string, FieldMapping> = {
  title: {
    notionProp: "Title",
    converter: (value: any) => ({ title: [{ text: { content: value } }] }),
  },
  isbn: {
    notionProp: "ISBN",
    converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  },
  author: {
    notionProp: "Author",
    converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  },
  img: {
    notionProp: "CoverImage",
    converter: (value: any) => ({ url: value }),
  },
  publisher: {
    notionProp: "Publisher",
    converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  },
  pubdate: {
    notionProp: "PublishedDate",
    converter: (value: any) => ({ date: { start: value } }),
  },
  summary: {
    notionProp: "Summary",
    converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  },
  // pubplace: {
  //   notionProp: "PubPlace",
  //   converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  // },
  // pages: {
  //   notionProp: "Pages",
  //   converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  // },
  // price: {
  //   notionProp: "Price",
  //   converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  // },
  // binding: {
  //   notionProp: "Binding",
  //   converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  // },
  // edition: {
  //   notionProp: "Edition",
  //   converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  // },
  // format: {
  //   notionProp: "Format",
  //   converter: (value: any) => ({ rich_text: [{ text: { content: value } }] }),
  // },
};

export class NotionApi {
  private notion: Client;

  constructor(apiKey: string) {
    this.notion = new Client({ auth: apiKey });
  }

  async isBookExists(isbn: string, databaseId: string): Promise<boolean> {
    const response = await this.notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "ISBN",
        rich_text: {
          equals: isbn,
        },
      },
    });

    return response.results.length > 0;
  }

  async createBookPage(
    databaseId: string,
    bookData: BookData
  ): Promise<CreatePageResponse> {
    const properties = Object.entries(bookData)
      .filter(([key, value]) => value && bookFieldMapping[key])
      .reduce((acc, [key, value]) => {
        const { notionProp, converter } = bookFieldMapping[key];
        acc[notionProp] = converter(value);
        return acc;
      }, {} as Record<string, any>);

    return await this.notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
  }

  async updateBookPage(pageId: string, bookData: BookData) {
    const properties = Object.entries(bookData)
      .filter(([key, value]) => value && bookFieldMapping[key])
      .reduce((acc, [key, value]) => {
        const { notionProp, converter } = bookFieldMapping[key];
        acc[notionProp] = converter(value);
        return acc;
      }, {} as Record<string, any>);

    await this.notion.pages.update({
      page_id: pageId,
      properties,
    });
  }

  async getDb(databaseId: string) {
    const db = await this.notion.databases.retrieve({
      database_id: databaseId,
    });
    return db;
  }
}

async function main() {
  const notionApiKey = process.env.NOTION_API_KEY!;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID!;
  const notion = new NotionApi(notionApiKey);
  const db = await notion.getDb(notionDatabaseId);

  // console.log(`db: ${JSON.stringify(db, null, 2)}`);
  // console.log(db);

  // console.log("Database:", db.title[0]?.plain_text || "Untitled");
  // console.log("Schema:");
  // for (const [key, value] of Object.entries(db.properties)) {
  //   console.log(`- ${key} ${getPropertyValue(value)}`);
  // }

  // first check if book exists
  const isbn = "9787115424914";
  const check = await notion.isBookExists(isbn, notionDatabaseId);
  console.log(`Book exists: ${check} for isbn: ${isbn}`);

  // create book
  const bookData: any = {
    isbn,
    title: "图解密码技术",
    img: "http://static1.showapi.com/app2/isbn/imgs/72868dd64dcd404e92f19d6f21ee9c71.jpg",
  };
  const page = await notion.createBookPage(notionDatabaseId, bookData);
  console.log(`create page with url ${page.url}`);
}

// main();
