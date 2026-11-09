import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { adminReadLimiter, authLimiter, reportExportLimiter, rolePinLimiter } from "./rateLimit";

describe("sensitive endpoint rate limits", () => {
  it("uses one limit key for Azure forwarded IPs with different source ports", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.get("/limited", adminReadLimiter, (_req, res) => res.sendStatus(200));

    const first = await request(app).get("/limited")
      .set("X-Forwarded-For", "167.179.154.81:11399").expect(200);
    const second = await request(app).get("/limited")
      .set("X-Forwarded-For", "167.179.154.81:11400").expect(200);
    const otherClient = await request(app).get("/limited")
      .set("X-Forwarded-For", "167.179.154.82:11399").expect(200);

    expect(first.headers["ratelimit-remaining"]).toBe("19");
    expect(second.headers["ratelimit-remaining"]).toBe("18");
    expect(otherClient.headers["ratelimit-remaining"]).toBe("19");
  });

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
