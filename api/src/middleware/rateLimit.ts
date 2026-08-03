import { rateLimit } from "express-rate-limit";

/**
 * Broad group limiters
 */
export const attendanceLimiter = rateLimit({
  windowMs: 60_000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attendance requests. Please try again shortly." },
});

export const adminLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many admin requests. Please try again shortly." },
});

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication requests. Please try again shortly." },
});

/**
 * Auth/session endpoints
 */
export const csrfTokenLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Attendance public/user-flow endpoints
 */
export const usernameCheckLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many username checks. Please try again shortly." },
});

export const usernameSearchLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many username searches. Please try again shortly." },
});

export const attendanceSubmitLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attendance submissions. Please try again shortly." },
});

export const incidentCreateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many incident creation attempts. Please try again shortly." },
});

export const eventListLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many event list requests. Please try again shortly." },
});

/**
 * Admin user-management endpoints
 */
export const adminReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminUserMutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many user-management changes. Please try again shortly." },
});

export const adminDeleteLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many delete attempts. Please try again shortly." },
});

/**
 * Admin reporting endpoints
 */
export const reportRunLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many report requests. Please try again shortly." },
});

export const reportExportLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many report exports. Please try again shortly." },
});

export const rolePinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many PIN attempts. Please try again later.",
  },
});

export const roleUpdateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many role update attempts. Please try again shortly.",
  },
});

export const roleReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many role assignment requests. Please try again shortly.",
  },
});