import crypto from "crypto";
import { RequestHandler } from "express";

const CSRF_HEADER = "x-csrf-token";

export const csrfMiddleware: RequestHandler = (req, res, next) => {
  const unsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);

  (req as any).csrfToken = () => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomUUID();
    }

    return req.session.csrfToken;
  };

  if (!unsafe) {
    next();
    return;
  }

  const sent = req.get(CSRF_HEADER);

  if (typeof sent !== "string") {
    res.status(403).json({
      message: "Missing CSRF token.",
    });
    return;
  }

  if (typeof req.session.csrfToken !== "string") {
    res.status(403).json({
      message: "CSRF session token missing.",
    });
    return;
  }

  if (sent !== req.session.csrfToken) {
    res.status(403).json({
      message: "Invalid CSRF token.",
    });
    return;
  }

  next();
};