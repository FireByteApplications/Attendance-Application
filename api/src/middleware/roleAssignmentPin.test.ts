import { afterEach, describe, expect, it, vi } from "vitest";
import { requireRoleAssignmentPin } from "./roleAssignmentPin";

function invoke(session: Record<string, unknown>) {
  const req = { session } as any;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  const next = vi.fn();
  requireRoleAssignmentPin(req, res as any, next);
  return { req, res, next };
}

afterEach(() => vi.useRealTimers());

describe("requireRoleAssignmentPin", () => {
  it("blocks a locked session", () => {
    const { req, res, next } = invoke({});
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
    expect(req.session.canAssignRoles).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it("permits an unlocked session within 30 minutes", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-05T00:00:00Z"));
    const { next } = invoke({ canAssignRoles: true, roleAssignmentUnlockedAt: Date.now() - 29 * 60_000 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("expires an unlock older than 30 minutes", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-05T00:00:00Z"));
    const { req, res, next } = invoke({ canAssignRoles: true, roleAssignmentUnlockedAt: Date.now() - 31 * 60_000 });
    expect(res.statusCode).toBe(401);
    expect(req.session.canAssignRoles).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });
});
