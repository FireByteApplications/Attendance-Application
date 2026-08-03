import { RequestHandler } from "express";

const roleAssignmentUnlockMinutes = 30;

export const requireRoleAssignmentPin: RequestHandler = (req, res, next) => {
  const unlockedAt = req.session.roleAssignmentUnlockedAt ?? 0;
  const maxAge = roleAssignmentUnlockMinutes * 60 * 1000;

  const isUnlocked =
    req.session.canAssignRoles === true &&
    Date.now() - unlockedAt <= maxAge;

  if (isUnlocked) {
    next();
    return;
  }

  req.session.canAssignRoles = false;

  res.status(401).json({
    ok: false,
    message: "Role assignment PIN required.",
  });
};