import { describe, it, expect } from "vitest";
import app from "./index";

describe("Index API /ping endpoint tests", () => {
  it('GET /ping should return message "Pong"', async () => {
    // Use the fetch method exported from index.ts
    const response = await app.request("/ping");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ message: "Pong" });
  });
});
