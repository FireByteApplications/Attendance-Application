import express from "express";
import session from "express-session";
import request from "supertest";
import fetch from "node-fetch";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

// Exercise the real Express stack without Azure, MongoDB, or an open TCP port.
// Rate limits have separate tests; disabling them here keeps endpoint assertions
// independent of test order and the number of requests from one test client.
vi.mock("./middleware/rateLimit", () => ({
  attendanceLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  csrfTokenLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authStatusLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  usernameCheckLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  usernameSearchLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  attendanceSubmitLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  incidentCreateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  eventListLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminReadLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminUserMutationLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminDeleteLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  reportRunLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  reportExportLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  roleReadLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  rolePinLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  roleUpdateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("connect-mongo", () => ({
  default: { create: () => new session.MemoryStore() },
}));
vi.mock("node-fetch", () => ({ default: vi.fn() }));
vi.mock("express", async (importOriginal) => {
  const original = await importOriginal<typeof import("express")>();
  const realExpress = (original as any).default ?? original;
  const create = Object.assign(() => {
    const instance = realExpress();
    instance.listen = vi.fn(() => {
      app = instance;
      return {} as any;
    });
    return instance;
  }, realExpress);
  return { ...original, default: create };
});

let collections: Record<string, ReturnType<typeof collection>>;
vi.mock("mongodb", async (importOriginal) => {
  const original = await importOriginal<typeof import("mongodb")>();
  return {
    ...original,
    MongoClient: class {
      connect = async () => this;
      db = () => ({ collection: (name: string) => collections[name] });
    },
  };
});

function cursor(rows: unknown[] = []) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(rows),
  };
}

function collection() {
  return {
    find: vi.fn(() => cursor()),
    findOne: vi.fn().mockResolvedValue(null),
    findOneAndUpdate: vi.fn().mockResolvedValue({ seq: 1 }),
    insertOne: vi.fn().mockResolvedValue({ insertedId: "new-id" }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    bulkWrite: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn(() => cursor()),
  };
}

let app: express.Express;

type Agent = ReturnType<typeof request.agent>;

async function csrf(agent: Agent) {
  const response = await agent.get("/csrf-token").expect(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  return response.body.csrfToken as string;
}

function call(agent: Agent, method: string, path: string) {
  if (method === "GET") return agent.get(path);
  if (method === "POST") return agent.post(path);
  if (method === "PATCH") return agent.patch(path);
  if (method === "DELETE") return agent.delete(path);
  throw new Error(`Unsupported test method: ${method}`);
}

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.get("/auth/login").expect(302);
  const state = new URL(login.headers.location).searchParams.get("state");
  vi.mocked(fetch)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) } as any)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "u1", displayName: "Admin", mail: "a@example.org" }) } as any)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [{ id: "admin-group" }] }) } as any);
  await agent.get(`/auth/redirect?code=abc&state=${state}`).expect(302);
  const token = await csrf(agent);
  return { agent, token };
}

async function unlockedAgent() {
  const agent = request.agent(app);
  const token = await csrf(agent);
  await agent.post("/api/attendance/roleAssignment/unlock")
    .set("X-CSRF-Token", token).send({ pin: "1234" }).expect(200);
  return { agent, token };
}

const adminRoutes = [
  ["GET", "/api/users/list"],
  ["GET", "/api/users/names"],
  ["POST", "/api/users/addUser"],
  ["DELETE", "/api/users/delete"],
  ["PATCH", "/api/users/updateRecord"],
  ["POST", "/api/reports/run"],
  ["POST", "/api/reports/export"],
  ["POST", "/api/reports/roles/run"],
  ["POST", "/api/reports/roles/export"],
] as const;

const pinRoutes = [
  ["DELETE", "/api/attendance/deleteIncident/INC-1"],
  ["GET", "/api/attendance/roleAssignment/events"],
  ["GET", "/api/attendance/roleAssignment/attendees"],
  ["PATCH", "/api/attendance/roleAssignment/updateRoles"],
  ["POST", "/api/attendance/roleAssignment/addAttendance"],
] as const;

const publicRoutes = [
  ["GET", "/csrf-token"],
  ["GET", "/auth/login"],
  ["GET", "/auth/redirect"],
  ["GET", "/auth/check"],
  ["GET", "/auth/session"],
  ["GET", "/auth/logout"],
  ["POST", "/api/attendance/checkUser"],
  ["POST", "/api/attendance/submit"],
  ["GET", "/api/attendance/usernameList"],
  ["POST", "/api/attendance/createIncident"],
  ["GET", "/api/attendance/listIncidents"],
  ["GET", "/api/attendance/listEvents"],
  ["GET", "/api/attendance/roleAssignment/status"],
  ["POST", "/api/attendance/roleAssignment/unlock"],
] as const;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("COSMOS_DB_URI", "mongodb://example.invalid");
  vi.stubEnv("SESSION_STORE_URL", "mongodb://example.invalid");
  vi.stubEnv("SESSION_SECRET", "test-only-session-secret");
  vi.stubEnv("DB_NAME", "test");
  vi.stubEnv("AZURE_TENANT_ID", "tenant-test");
  vi.stubEnv("AZURE_CLIENT_ID", "client-test");
  vi.stubEnv("AZURE_CLIENT_SECRET", "secret-test");
  vi.stubEnv("AZURE_REDIRECT_URI", "http://localhost/auth/redirect");
  vi.stubEnv("ADMIN_GROUP_ID", "admin-group");
  vi.stubEnv("FRONTEND_URL", "http://localhost:5173");
  vi.stubEnv("POST_LOGOUT_URL", "http://localhost:5173");
  vi.stubEnv("ROLE_ASSIGNMENT_PIN", "1234");
  collections = {
    Usernames: collection(),
    Records: collection(),
    Events: collection(),
    Counters: collection(),
  };
  await import("./index");
  await vi.waitFor(() => expect(app).toBeDefined());
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetch).mockReset();
  for (const value of Object.values(collections)) {
    value.find.mockImplementation(() => cursor());
    value.findOne.mockResolvedValue(null);
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("API route and security contracts", () => {
  it("registers the complete endpoint inventory", () => {
    const actual = (app as any).router.stack
      .filter((layer: any) => layer.route)
      .flatMap((layer: any) => Object.keys(layer.route.methods).map((method) =>
        `${method.toUpperCase()} ${layer.route.path}`));
    const expected = [...adminRoutes, ...pinRoutes, ...publicRoutes]
      .map(([method, path]) => `${method} ${path.replace("/INC-1", "/:eventNumber")}`);
    expect(actual.sort()).toEqual(expected.sort());
  });

  it.each([...adminRoutes, ...pinRoutes, ...publicRoutes].filter(([method]) => method !== "GET"))(
    "rejects %s %s without a CSRF token",
    async (method, path) => {
      const response = await call(request.agent(app), method, path).send({});
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_HEADER_MISSING");
    },
  );

  it.each(adminRoutes)("denies anonymous access to %s %s", async (method, path) => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const response = await call(agent, method, path).set("X-CSRF-Token", token).send({});
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Admins only" });
  });

  it.each(pinRoutes)("denies locked access to %s %s", async (method, path) => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const response = await call(agent, method, path).set("X-CSRF-Token", token).send({});
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ ok: false, message: "Role assignment PIN required." });
  });

  it("sets API security headers", async () => {
    const response = await request(app).get("/auth/check");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("authentication and PIN workflows", () => {
  it("reports anonymous sessions as unauthenticated", async () => {
    const agent = request.agent(app);
    await agent.get("/auth/check").expect(401, { authenticated: false });
    await agent.get("/auth/session").expect(401);
  });

  it("rejects an OAuth callback with missing or mismatched state", async () => {
    const agent = request.agent(app);
    await agent.get("/auth/redirect?code=abc&state=wrong").expect(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates a PKCE login URL, authenticates an admin, and logs out", async () => {
    const agent = request.agent(app);
    const login = await agent.get("/auth/login").expect(302);
    const url = new URL(login.headers.location);
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "u1", displayName: "Admin", mail: "a@example.org" }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [{ id: "admin-group" }] }) } as any);
    const callback = await agent.get(`/auth/redirect?code=abc&state=${state}`).expect(302);
    expect(callback.headers.location).toBe("http://localhost:5173/admin/dashboard");
    expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain("code_verifier=");
    await agent.get("/auth/check").expect(200).expect((response) => {
      expect(response.body).toMatchObject({ authenticated: true, isAdmin: true });
    });
    await agent.get("/auth/session").expect(200);
    await agent.get("/auth/logout").expect(302);
    await agent.get("/auth/check").expect(401);
  });

  it("does not grant admin access when the Azure group is absent", async () => {
    const agent = request.agent(app);
    const login = await agent.get("/auth/login").expect(302);
    const state = new URL(login.headers.location).searchParams.get("state");
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "u2", displayName: "Member", mail: "m@example.org" }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) } as any);
    await agent.get(`/auth/redirect?code=abc&state=${state}`).expect(302);
    await agent.get("/auth/check").expect(200).expect((response) => {
      expect(response.body).toMatchObject({ authenticated: true, isAdmin: false });
    });
    await agent.get("/api/users/list").expect(403);
  });

  it("keeps the existing PIN unlock and lock behavior", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    await agent.get("/api/attendance/roleAssignment/status").expect(200, { unlocked: false });
    await agent.post("/api/attendance/roleAssignment/unlock").set("X-CSRF-Token", token)
      .send({ pin: "9999" }).expect(403);
    await agent.post("/api/attendance/roleAssignment/unlock").set("X-CSRF-Token", token)
      .send({ pin: "1234" }).expect(200);
    await agent.get("/api/attendance/roleAssignment/status").expect(200, { unlocked: true });
    await agent.post("/api/attendance/roleAssignment/unlock").set("X-CSRF-Token", token)
      .send({ pin: "9999" }).expect(403);
    await agent.get("/api/attendance/roleAssignment/status").expect(200, { unlocked: false });
  });
});

describe("attendance and public data", () => {
  it("checks selected usernames and reports missing members", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    collections.Usernames.find.mockImplementation(() => cursor([{ username: "alex.smith" }]));
    await agent.post("/api/attendance/checkUser").set("X-CSRF-Token", token)
      .send({ usernames: ["Alex.Smith"] }).expect(200, { ok: true, usernames: ["alex.smith"] });
    await agent.post("/api/attendance/checkUser").set("X-CSRF-Token", token)
      .send({ usernames: ["Alex.Smith", "missing.person"] }).expect(404)
      .expect((response) => expect(response.body.missingUsernames).toEqual(["missing.person"]));
  });

  it("escapes username search metacharacters and caps results", async () => {
    collections.Usernames.find.mockImplementation(() => cursor([{ username: "a.b" }]));
    await request(app).get("/api/attendance/usernameList?q=a.").expect(200, ["a.b"]);
    const query = (collections.Usernames.find as any).mock.calls[0][0];
    expect(query.username.source).toBe("^a\\.");
    await request(app).get("/api/attendance/usernameList?q=a*").expect(400);
    await request(app).get("/api/attendance/usernameList?q=a").expect(200, []);
  });

  it("lists incident and non-incident events", async () => {
    collections.Events.find.mockImplementation(() => cursor([{ eventNumber: "EVT-1" }]));
    await request(app).get("/api/attendance/listIncidents").expect(200, [{ eventNumber: "EVT-1" }]);
    await request(app).get("/api/attendance/listEvents").expect(200, [{ eventNumber: "EVT-1" }]);
    expect(collections.Events.find).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid incident creation and accepts a valid incident", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    await agent.post("/api/attendance/createIncident").set("X-CSRF-Token", token)
      .send({}).expect(400);
    const response = await agent.post("/api/attendance/createIncident").set("X-CSRF-Token", token)
      .send({ date: "2026-11-05", activID: "26-42", incidentDescription: "Test call" });
    expect(response.status).toBe(200);
    expect(collections.Events.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      eventNumber: "26-42", eventType: "Incident-Call",
    }));
  });

  it("requires username validation in the same session before submitting attendance", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const body = {
      name: "Alex Smith", operational: "Operational", activity: "Maintenance",
      epochTimestamp: 1793790000000,
    };
    await agent.post("/api/attendance/submit").set("X-CSRF-Token", token)
      .send(body).expect(403);
    expect(collections.Records.insertOne).not.toHaveBeenCalled();
    collections.Usernames.find.mockImplementation(() => cursor([{ username: "alex.smith" }]));
    await agent.post("/api/attendance/checkUser").set("X-CSRF-Token", token)
      .send({ username: "alex.smith" }).expect(200);
    await agent.post("/api/attendance/submit").set("X-CSRF-Token", token)
      .send(body).expect(201).expect((response) => {
        expect(response.body).toMatchObject({ insertedCount: 1, eventCreated: false });
      });
    expect(collections.Records.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      name: "Alex Smith", activity: "Maintenance", roles: [],
    }));
  });

  it("returns a conflict for a duplicate incident number", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    collections.Events.insertOne.mockRejectedValueOnce({ code: 11000 });
    await agent.post("/api/attendance/createIncident").set("X-CSRF-Token", token)
      .send({ date: "2026-11-05", activID: "26-43", incidentDescription: "Test call" })
      .expect(409);
  });
});

describe("administrator endpoints", () => {
  it("lists members and names for an authenticated admin", async () => {
    const { agent } = await adminAgent();
    collections.Usernames.find.mockImplementation(() => cursor([{ name: "Alex Smith", id: "123" }]));
    await agent.get("/api/users/list").expect(200, [{ name: "Alex Smith", id: "123" }]);
    await agent.get("/api/users/names").expect(200, [{ name: "Alex Smith", id: "123" }]);
  });

  it("validates and creates a member, then deletes by fire zone number", async () => {
    const { agent, token } = await adminAgent();
    const body = {
      firstName: "alex", lastName: "smith", fireZoneNumber: "123",
      Status: "Active", Classification: "Ordinary", Type: "Operational",
    };
    await agent.post("/api/users/addUser").set("X-CSRF-Token", token)
      .send({ ...body, honeypot: "bot" }).expect(400);
    await agent.post("/api/users/addUser").set("X-CSRF-Token", token)
      .send(body).expect(201);
    expect(collections.Usernames.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      name: "Alex Smith", username: "alex.smith", id: "123",
    }));
    await agent.delete("/api/users/delete").set("X-CSRF-Token", token)
      .send({ numbers: ["bad"] }).expect(400);
    await agent.delete("/api/users/delete").set("X-CSRF-Token", token)
      .send({ numbers: ["123"] }).expect(200);
    expect(collections.Usernames.deleteMany).toHaveBeenCalledWith({ id: { $in: ["123"] } });
  });

  it("updates a member and associated record names", async () => {
    const { agent, token } = await adminAgent();
    collections.Usernames.findOneAndUpdate.mockResolvedValueOnce({ id: "123" });
    const body = {
      oldname: "Alex Smith", name: "Alex Jones", oldfzNumber: "123", fzNumber: "124",
      memberStatus: "Active", memberClassification: "Ordinary", memberType: "Operational",
    };
    await agent.patch("/api/users/updateRecord").set("X-CSRF-Token", token)
      .send(body).expect(200);
    expect(collections.Usernames.findOneAndUpdate).toHaveBeenCalledWith(
      { id: "123" }, { $set: expect.objectContaining({ name: "Alex Jones", id: "124" }) },
      { returnDocument: "after" },
    );
    expect(collections.Records.updateMany).toHaveBeenCalledWith(
      { name: "Alex Smith" }, { $set: { name: "Alex Jones" } },
    );
  });

  it("runs and exports attendance reports with validated date filters", async () => {
    const { agent, token } = await adminAgent();
    const startEpoch = Date.UTC(2026, 10, 1);
    const endEpoch = Date.UTC(2026, 10, 2);
    await agent.post("/api/reports/run").set("X-CSRF-Token", token)
      .send({ startEpoch: 1, endEpoch, detailed: true }).expect(400);
    collections.Records.find.mockImplementation(() => cursor([{
      name: "Alex Smith", activity: "Maintenance", operational: "Operational",
      epochTimestamp: startEpoch, details: {},
    }]));
    await agent.post("/api/reports/run").set("X-CSRF-Token", token)
      .send({ startEpoch, endEpoch, detailed: true }).expect(200)
      .expect((response) => expect(response.body).toMatchObject({ count: 1 }));
    const exported = await agent.post("/api/reports/export").set("X-CSRF-Token", token)
      .send({ startEpoch, endEpoch, detailed: true, includeZeroAttendance: false,
        formattedStart: "20261101", formattedEnd: "20261102" });
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(exported.headers["content-disposition"]).toContain(".xlsx");
  });

  it("pages detailed attendance on the server and rejects oversized pages", async () => {
    const { agent, token } = await adminAgent();
    const startEpoch = Date.UTC(2026, 10, 1);
    const body = { startEpoch, endEpoch: startEpoch + 86_400_000, detailed: true };
    await agent.post('/api/reports/run').set('X-CSRF-Token', token)
      .send({ ...body, page: 1, pageSize: 101 }).expect(400);
    const pageCursor = cursor([{ name: 'Alex Smith', epochTimestamp: startEpoch, details: {} }]);
    collections.Records.find.mockReturnValue(pageCursor);
    collections.Records.countDocuments.mockResolvedValueOnce(120);
    const result = await agent.post('/api/reports/run').set('X-CSRF-Token', token)
      .send({ ...body, page: 2, pageSize: 50 }).expect(200);
    expect(result.body).toMatchObject({ count: 120, page: 2, pageSize: 50 });
    expect(result.body.records).toHaveLength(1);
    expect(pageCursor.sort).toHaveBeenCalledWith({ epochTimestamp: 1, _id: 1 });
    expect(pageCursor.skip).toHaveBeenCalledWith(50);
    expect(pageCursor.limit).toHaveBeenCalledWith(50);
  });

  it("runs role reports and rejects an empty role export", async () => {
    const { agent, token } = await adminAgent();
    const body = { startEpoch: Date.UTC(2026, 10, 1), endEpoch: Date.UTC(2026, 10, 2),
      names: ["Alex Smith"], roles: ["Driver"] };
    await agent.post("/api/reports/roles/run").set("X-CSRF-Token", token)
      .send({ ...body, names: [], roles: [] }).expect(400);
    collections.Records.find.mockImplementation(() => cursor([{
      name: "alex  smith", eventNumber: "EVT-00001", operational: "Operational",
      activity: "Training", roles: ["Driver"], epochTimestamp: body.startEpoch,
    }]));
    await agent.post("/api/reports/roles/run").set("X-CSRF-Token", token)
      .send(body).expect(200).expect((response) => {
        expect(response.body).toMatchObject({ count: 1 });
        expect(response.body.records[0].name).toBe("Alex Smith");
      });
    collections.Records.find.mockImplementation(() => cursor());
    await agent.post("/api/reports/roles/export").set("X-CSRF-Token", token)
      .send(body).expect(404);
  });

  it("pages role reports on the server", async () => {
    const { agent, token } = await adminAgent();
    const startEpoch = Date.UTC(2026, 10, 1);
    const pageCursor = cursor([{ name: 'Alex Smith', epochTimestamp: startEpoch }]);
    collections.Records.find.mockReturnValue(pageCursor);
    collections.Records.countDocuments.mockResolvedValueOnce(80);
    const result = await agent.post('/api/reports/roles/run').set('X-CSRF-Token', token)
      .send({ startEpoch, endEpoch: startEpoch + 86_400_000,
        names: ['Alex Smith'], roles: [], page: 2, pageSize: 50 }).expect(200);
    expect(result.body).toMatchObject({ count: 80, page: 2, pageSize: 50 });
    expect(result.body.records).toHaveLength(1);
    expect(pageCursor.skip).toHaveBeenCalledWith(50);
    expect(pageCursor.limit).toHaveBeenCalledWith(50);
  });

  it("exports a role report as an Excel attachment", async () => {
    const { agent, token } = await adminAgent();
    const startEpoch = Date.UTC(2026, 10, 1);
    collections.Records.find.mockImplementation(() => cursor([{
      name: "Alex Smith", eventNumber: "EVT-00001", operational: "Operational",
      activity: "Training", roles: ["Driver"], epochTimestamp: startEpoch,
    }]));
    collections.Events.find.mockImplementation(() => cursor([{
      eventNumber: "EVT-00001", description: "Training day",
    }]));
    const response = await agent.post("/api/reports/roles/export").set("X-CSRF-Token", token)
      .send({ startEpoch, endEpoch: startEpoch + 86_400_000,
        names: ["Alex Smith"], roles: ["Driver"] });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(response.headers["content-disposition"]).toContain(".xlsx");
  });
});

describe("PIN-protected role and event endpoints", () => {
  it("lists events by date and attendees by event number after unlocking", async () => {
    const { agent } = await unlockedAgent();
    collections.Events.find.mockImplementation(() => cursor([
      { eventNumber: "EVT-00002", eventType: "Training" },
      { eventNumber: "EVT-00001", eventType: "Maintenance" },
    ]));
    await agent.get("/api/attendance/roleAssignment/events?date=bad").expect(400);
    await agent.get("/api/attendance/roleAssignment/events?date=2026-11-05")
      .expect(200).expect((response) => {
        expect(response.body.map((event: any) => event.eventNumber)).toEqual(["EVT-00001", "EVT-00002"]);
      });
    collections.Records.find.mockImplementation(() => cursor([{
      _id: { toString: () => "507f1f77bcf86cd799439011" }, name: "Alex Smith",
      eventNumber: "EVT-00001", roles: ["Driver"], epochTimestamp: Date.UTC(2026, 10, 5),
    }]));
    await agent.get("/api/attendance/roleAssignment/attendees?eventNumber=bad").expect(400);
    await agent.get("/api/attendance/roleAssignment/attendees?eventNumber=EVT-00001")
      .expect(200).expect((response) => {
        expect(response.body[0]).toMatchObject({ recordId: "507f1f77bcf86cd799439011", roles: ["Driver"] });
      });
  });

  it("validates and applies role updates only to a record in the selected event", async () => {
    const { agent, token } = await unlockedAgent();
    const path = "/api/attendance/roleAssignment/updateRoles";
    await agent.patch(path).set("X-CSRF-Token", token)
      .send({ eventNumber: "EVT-00001", updates: [{ recordId: "bad", roles: ["Driver"] }] })
      .expect(400);
    await agent.patch(path).set("X-CSRF-Token", token)
      .send({ eventNumber: "EVT-00001", updates: [{ recordId: "507f1f77bcf86cd799439011", roles: ["invalid"] }] })
      .expect(400);
    await agent.patch(path).set("X-CSRF-Token", token)
      .send({ eventNumber: "EVT-00001", updates: [{ recordId: "507f1f77bcf86cd799439011", roles: ["Driver"] }] })
      .expect(200);
    expect(collections.Records.bulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: expect.anything(), eventNumber: "EVT-00001" },
        update: { $set: { roles: ["Driver"], rolesUpdatedAtEpoch: expect.any(Number) } } } },
    ]);
  });

  it("adds a missing member's attendance and blocks duplicate additions", async () => {
    const { agent, token } = await unlockedAgent();
    const path = "/api/attendance/roleAssignment/addAttendance";
    collections.Events.findOne.mockResolvedValue({
      eventNumber: "EVT-00001", eventDate: "2026-11-05", eventType: "Training",
    });
    collections.Usernames.find.mockImplementation(() => cursor([{ username: "alex.smith", name: "Alex Smith" }]));
    collections.Records.find.mockImplementation(() => cursor());
    await agent.post(path).set("X-CSRF-Token", token)
      .send({ eventNumber: "EVT-00001", usernames: ["alex.smith"] }).expect(201);
    expect(collections.Records.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Alex Smith", eventNumber: "EVT-00001", roles: [] }),
    ]);
    collections.Records.find.mockImplementation(() => cursor([{ name: "Alex Smith" }]));
    await agent.post(path).set("X-CSRF-Token", token)
      .send({ eventNumber: "EVT-00001", usernames: ["alex.smith"] }).expect(409);
  });

  it("prevents deletion when an incident has attendance", async () => {
    const { agent, token } = await unlockedAgent();
    collections.Events.findOne.mockResolvedValue({ eventNumber: "26-42" });
    collections.Records.countDocuments.mockResolvedValue(1);
    await agent.delete("/api/attendance/deleteIncident/26-42")
      .set("X-CSRF-Token", token).expect(409);
    expect(collections.Events.deleteOne).not.toHaveBeenCalled();
    collections.Records.countDocuments.mockResolvedValue(0);
    await agent.delete("/api/attendance/deleteIncident/26-42")
      .set("X-CSRF-Token", token).expect(200);
    expect(collections.Events.deleteOne).toHaveBeenCalledWith({ eventNumber: "26-42" });
  });
});
