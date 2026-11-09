import { describe, expect, it, vi } from "vitest";

import { csrfMiddleware } from "./csrfToken";

function createResponse() {
  const response = {
    body: undefined as unknown,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response;
}

describe("csrfMiddleware", () => {
  it("allows safe requests and provides a session token factory", () => {
    const request = {
      method: "GET",
      session: {},
      get: vi.fn(),
    } as any;
    const response = createResponse();
    const next = vi.fn();

    csrfMiddleware(request, response as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.csrfToken()).toEqual(expect.any(String));
    expect(request.session.csrfToken).toBe(request.csrfToken());
  });

  it("rejects an unsafe request without a token header", () => {
    const request = {
      method: "POST",
      session: { csrfToken: "session-token" },
      get: vi.fn().mockReturnValue(undefined),
    } as any;
    const response = createResponse();
    const next = vi.fn();

    csrfMiddleware(request, response as any, next);

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ code: "CSRF_HEADER_MISSING" });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows an unsafe request with the matching session token", () => {
    const request = {
      method: "PATCH",
      session: { csrfToken: "session-token" },
      get: vi.fn().mockReturnValue("session-token"),
    } as any;
    const response = createResponse();
    const next = vi.fn();

    csrfMiddleware(request, response as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects %s when the supplied token differs from the session token",
    (method) => {
      const request = {
        method,
        session: { csrfToken: "session-token" },
        get: vi.fn().mockReturnValue("forged-token"),
      } as any;
      const response = createResponse();
      const next = vi.fn();

      csrfMiddleware(request, response as any, next);

      expect(response.statusCode).toBe(403);
      expect(response.body).toMatchObject({ code: "CSRF_TOKEN_INVALID" });
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("rejects a header token when the session has no token", () => {
    const request = {
      method: "POST",
      session: {},
      get: vi.fn().mockReturnValue("forged-token"),
    } as any;
    const response = createResponse();
    const next = vi.fn();

    csrfMiddleware(request, response as any, next);

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ code: "CSRF_SESSION_TOKEN_MISSING" });
    expect(next).not.toHaveBeenCalled();
  });
});
