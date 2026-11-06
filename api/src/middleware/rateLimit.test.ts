import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authLimiter, reportExportLimiter, rolePinLimiter } from "./rateLimit";

describe("sensitive endpoint rate limits", () => {
  it.each([
    ["authentication", authLimiter, 5],
    ["PIN attempts", rolePinLimiter, 5],
    ["report exports", reportExportLimiter, 3],
  ])("limits %s after its allowed requests", async (_name, limiter, max) => {
    const app = express();
    app.get("/limited", limiter, (_req, res) => res.sendStatus(200));
    for (let attempt = 0; attempt < max; attempt++) {
      await request(app).get("/limited").expect(200);
    }
    const blocked = await request(app).get("/limited").expect(429);
    expect(blocked.body).toEqual(expect.objectContaining({ message: expect.any(String) }));
  });
});
