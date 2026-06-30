import { Request, Response, NextFunction } from 'express';
import moment from 'moment';
import validator from 'validator';

const allowedRoles = new Set([
  "Crew Leader",
  "Driver",
  "Pump Operator",
  "BA Operator",
  "BACO",
  "Hose Operator",
  "Chainsaw Operator",
]);

const MAX_REPORT_SPAN = 1095 * 24 * 60 * 60 * 1000; // 3 years

const MAX_SELECTED_MEMBERS = 300;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function sanitiseRoles(value: unknown, opts?: { max?: number }): string[] | null {
  if (value == null) return [];
  if (!isStringArray(value)) return null;

  const max = opts?.max ?? 20;
  if (value.length > max) return null;

  const sanitised = value
    .map((r) => validator.trim(r).replace(/\0/g, ""))
    .filter((r) => r.length > 0);

  for (const r of sanitised) {
    if (!allowedRoles.has(r)) return null;
  }

  return Array.from(new Set(sanitised));
}

function sanitizeNamesArray(names: unknown) {
  if (!Array.isArray(names)) {
    return null;
  }

  return names
    .map((name) => validator.trim(String(name ?? "")))
    .filter(Boolean);
}

function isValidMemberName(name: string) {
  return /^[A-Za-z\s.'-]{1,100}$/.test(name);
}

function sanitizeRoleReportBase(
  req: Request,
  res: Response,
  next: NextFunction,
  requireFormattedDates = false
) {
  const startEpoch = Number(req.body.startEpoch);
  const endEpoch = Number(req.body.endEpoch);
  const names = sanitizeNamesArray(req.body.names);

  if (
    !Number.isFinite(startEpoch) ||
    !Number.isFinite(endEpoch) ||
    endEpoch < startEpoch
  ) {
    res.status(400).json({
      message: "Invalid date range.",
    });
    return;
  }

  if (endEpoch - startEpoch > MAX_REPORT_SPAN) {
    res.status(400).json({
      message: "Date range too large. Maximum range is 3 years.",
    });
    return;
  }

  if (!names || names.length === 0) {
    res.status(400).json({
      message: "At least one member must be selected.",
    });
    return;
  }

  if (names.length > MAX_SELECTED_MEMBERS) {
    res.status(400).json({
      message: "Too many members selected.",
    });
    return;
  }

  const invalidNames = names.filter((name) => !isValidMemberName(name));

  if (invalidNames.length > 0) {
    res.status(400).json({
      message: `Invalid member names: ${invalidNames.join(", ")}`,
    });
    return;
  }

  req.body.startEpoch = startEpoch;
  req.body.endEpoch = endEpoch;
  req.body.names = names;

  if (requireFormattedDates) {
    const formattedStart = validator.trim(String(req.body.formattedStart ?? ""));
    const formattedEnd = validator.trim(String(req.body.formattedEnd ?? ""));

    const formattedDateRegex = /^\d{8}$/;

    if (
      formattedStart &&
      !formattedDateRegex.test(formattedStart)
    ) {
      res.status(400).json({
        message: "Invalid formatted start date.",
      });
      return;
    }

    if (
      formattedEnd &&
      !formattedDateRegex.test(formattedEnd)
    ) {
      res.status(400).json({
        message: "Invalid formatted end date.",
      });
      return;
    }

    req.body.formattedStart = formattedStart;
    req.body.formattedEnd = formattedEnd;
  }

  next();
}

function parseBoolean(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
  }
  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return undefined; // invalid / not a boolean
}

function isValidEventNumber(eventNumber: string) {
  return /^\d{2}-\d{1,8}$/.test(eventNumber) || /^EVT-\d{5}$/.test(eventNumber);
}

function isValidEventDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function sanitizeAttendanceInput(req: Request, res: Response, next: NextFunction) {
  const {
    name,
    operational,
    activity,
    epochTimestamp,
    baType,
    chainsawType,
    deploymentType,
    deploymentLocation,
    otherType,
    eventNumber
  } = req.body;

  const sanitized = {
    name: validator.trim(name || ''),
    operational: validator.trim(operational || ''),
    activity: validator.trim(activity || ''),
    baType: validator.trim(baType || ''),
    chainsawType: validator.trim(chainsawType || ''),
    deploymentType: validator.trim(deploymentType || ''),
    deploymentLocation: validator.trim(deploymentLocation || ''),
    otherType: validator.trim(otherType || ''),
    eventNumber : validator.trim(String(eventNumber ?? ""))
  };

  const validators = [
    { value: sanitized.name, pattern: /^[a-zA-Z-'\s]{1,50}$/, field: 'name' },
    { value: sanitized.operational, pattern: /^(Non-Operational)?(Operational)?$/, field: 'operational' },
    { value: sanitized.activity, pattern: /^[a-zA-Z\s-]{1,21}$/, field: 'activity' },
    { value: sanitized.baType, pattern: /^(Cat\s1)?(Pumper)?$/, field: 'baType' },
    { value: sanitized.chainsawType, pattern: /^(Cat\s1)?(Pumper)?(Cat\s9)?$/, field: 'chainsawType' },
    { value: sanitized.deploymentType, pattern: /^(Bushfire)?(Flood)?$/, field: 'deploymentType' },
    { value: sanitized.deploymentLocation, pattern: /^(Local)?(Out\sof\sarea)?$/, field: 'deploymentLocation' },
    { value: sanitized.otherType, pattern: /^[a-zA-Z0-9\s\.,\-\']{1,50}$/, field: 'otherType'},
    { value: sanitized.eventNumber, pattern: /^\d{2}-\d{1,8}$/, field: 'eventNumber'}
  ]

  for (const { value, pattern, field } of validators) {
    if (value && !pattern.test(value)) {
      res.status(400).json({ message: `Invalid characters in field: ${field}` });
      return;
    }
  }

  const epochTimestampNumber = Number(epochTimestamp);
  if (!Number.isInteger(epochTimestampNumber) || epochTimestampNumber <= 0) {
    res.status(400).json({ message: 'Invalid epochTimestamp' });
    return;
  }

  req.body = {
    ...sanitized,
    epochTimestamp: epochTimestampNumber
  };

  next();
}

export function sanitizeUpdatedUser(req: Request, res: Response, next: NextFunction) {
  const {oldname, name, oldfzNumber, fzNumber, memberStatus, memberClassification, memberType} = req.body
  const sanitized = {
    oldname: validator.trim(oldname || ''),
    name: validator.trim(name || ''),
    oldfzNumber: validator.trim(oldfzNumber || ''),
    fzNumber: validator.trim(fzNumber || ''),
    memberStatus: validator.trim(memberStatus || ''),
    memberClassification: validator.trim(memberClassification || ''),
    memberType: validator.trim(memberType || '')
  };

  const validators = [
    { value: sanitized.oldname, pattern: /^[a-zA-Z-'\s]{1,50}$/, field: 'Old Name' },
    { value: sanitized.name, pattern: /^[a-zA-Z-'\s]{1,50}$/, field: 'Name' },
    { value: sanitized.oldfzNumber, pattern: /^\d{1,9}?$/, field: 'Old Firezone Number' },
    { value: sanitized.fzNumber, pattern: /^\d{1,9}?$/, field: 'FireZone Number' },
    { value: sanitized.memberStatus, pattern: /^[a-zA-Z]{1,10}(\(?[a-zA-Z]{4}\))?$/, field: 'Membership Status' },
    { value: sanitized.memberClassification, pattern: /^[a-zA-Z]{1,12}$/, field: 'Membership Classification' },
    { value: sanitized.memberType, pattern: /^[a-zA-Z]{1,11}(\s[a-zA-Z]{7})?$/, field: 'Membership Type' }
  ]

  for (const { value, pattern, field } of validators) {
    if (value && !pattern.test(value)) {
      res.status(400).json({ message: `Invalid characters in field: ${field}` });
      return;
    }
  }
  req.body = {
    ...sanitized,
  };

  next();
}

export function sanitizeUser(req: Request, res: Response, next: NextFunction) {
  const { firstName, lastName, fireZoneNumber, Status, Classification, Type, honeypot, middleName } = req.body;
  const sanitized = {
    firstName: validator.trim(firstName || ''),
    lastName: validator.trim(lastName || ''),
    fireZoneNumber: validator.trim(fireZoneNumber || ''),
    Status: validator.trim(Status || ''),
    Classification: validator.trim(Classification || ''),
    Type: validator.trim(Type || ''),
    honeypot: validator.trim(honeypot || ''),
    middleName: validator.trim(middleName || '')
  };

  const validators = [
    { value: sanitized.firstName, pattern: /^[a-zA-Z-'\s]{1,25}$/, field: 'First Name' },
    { value: sanitized.lastName, pattern: /^[a-zA-Z-'\s]{1,25}$/, field: 'Last Name' },
    { value: sanitized.fireZoneNumber, pattern: /^\d{1,9}?$/, field: 'Firezone Number' },
    { value: sanitized.Status, pattern: /^[a-zA-Z]{1,10}(\(?[a-zA-Z]{4}\))?$/, field: 'Membership Status' },
    { value: sanitized.Classification, pattern: /^[a-zA-Z]{1,12}$/, field: 'Membership Classification' },
    { value: sanitized.Type, pattern: /^[a-zA-Z]{1,11}(\s[a-zA-Z]{7})?$/, field: 'Membership type' }
  ]

  for (const { value, pattern, field } of validators) {
    if (value && !pattern.test(value)) {
      res.status(400).json({ message: `Invalid characters in field: ${field}` });
      return;
    }
  }
  req.body = {
    ...sanitized,
  };

  next();
}

export function sanitizeReportingRunInput(req: Request, res: Response, next: NextFunction) {
  const {
    startEpoch,
    endEpoch,
    name,
    activity,
    operational,
    detailed,
    includeZeroAttendance,
    roles
  } = req.body ?? {};

  const sanitisedRoles = sanitiseRoles(roles);
  if (sanitisedRoles === null){
    res.status(400).json({
      message: `Invalid roles. Must be an array containing only: ${Array.from(allowedRoles).join(", ")}`,
    });
    return
  }

  const asTrimmedString = (v: unknown) => validator.trim(String(v ?? ''));

  const sanitized = {
    name: asTrimmedString(name),
    operational: asTrimmedString(operational),
    activity: asTrimmedString(activity),
    detailed: parseBoolean(detailed),
    includeZeroAttendance: parseBoolean(includeZeroAttendance),
    roles: sanitisedRoles
  };

  const validators = [
    { value: sanitized.name,               pattern: /^[a-zA-Z-'\s]{1,50}$/,  field: 'name' },
    { value: sanitized.operational,        pattern: /^(Non-Operational)?(Operational)?$/,  field: 'operational' },
    { value: sanitized.activity,           pattern: /^[a-zA-Z\s-]{1,21}$/,  field: 'activity' },
  ] as const;

  const minMS = moment.tz('2023-01-01 00:00:00', 'Australia/Sydney').valueOf();
  const maxMS = moment.tz('2100-12-31 23:59:59.999', 'Australia/Sydney').valueOf();
  function isEpochMS(n: unknown): n is number{
    return typeof n === 'number'
    && Number.isInteger(n)
    && n >= minMS && n <= maxMS;
  }

  for (const { value, pattern, field } of validators) {
    const s = String(value);
    if (s !== '' && !pattern.test(s)) {
      return res.status(400).json({ message: `Invalid characters in field: ${field}` });
    }
  }

  const startEpochMS = Number(startEpoch)
  const endEpochMS = Number(endEpoch)
  if (!isEpochMS(startEpochMS)) {return res.status(400).json({message: 'Start time must be after Jan 1 2023'})}
  if (!isEpochMS(endEpochMS)){return res.status(400).json({message: 'End time must be before Dec 31 2100'})}
    req.body = {
    ...sanitized,
    startEpoch: startEpochMS,
    endEpoch: endEpochMS,
  };

  return next();
}

export function sanitizeReportingExportInput(req: Request, res: Response, next: NextFunction) {
  const {
    startEpoch,
    endEpoch,
    name,
    activity,
    operational,
    includeZeroAttendance,
    roles,
    detailed,
    formattedStart,
    formattedEnd
  } = req.body ?? {};

  const sanitisedRoles = sanitiseRoles(roles);
  if (sanitisedRoles === null){
    res.status(400).json({
      message: `Invalid roles. Must be an array containing only: ${Array.from(allowedRoles).join(", ")}`,
    });
    return
  }

  const sanitized = {
    name: validator.trim(String(name ?? '')),
    operational: validator.trim(String(operational ?? '')),
    activity: validator.trim(String(activity ?? '')),
    formattedStart: validator.trim(String(formattedStart ?? '')),
    formattedEnd: validator.trim(String(formattedEnd ?? '')),

    includeZeroAttendance: parseBoolean(includeZeroAttendance),
    detailed: parseBoolean(detailed),
    roles: sanitisedRoles
  };

  function runRule(rule: { value: any; field: string; pattern?: RegExp; validate?: (v: any) => boolean }) {
    if (typeof rule.validate === 'function') {
      return { field: rule.field, ok: rule.validate(rule.value) };
    }
    if (rule.pattern instanceof RegExp) {
      const s = rule.value == null ? '' : String(rule.value).trim();
      return { field: rule.field, ok: s === '' || rule.pattern.test(s) };
    }
    return { field: rule.field, ok: true };
  }

  const validators = [

    { value: sanitized.name, field: 'name', pattern: /^([a-zA-Z-'\s]{1,50})?$/ },
    { value: sanitized.operational, field: 'operational', pattern: /^((Non-Operational)?(Operational)?)?$/ },
    { value: sanitized.activity, field: 'activity', pattern: /^([a-zA-Z\s-]{1,21})?$/ },

    { value: sanitized.includeZeroAttendance, field: 'includeZeroAttendance', validate: (v: boolean) => typeof v === 'boolean' },
    { value: sanitized.detailed, field: 'detailed', validate: (v: boolean) => typeof v === 'boolean' },
    { value: sanitized.formattedStart, field: 'formattedStart', pattern: /^\d{8}$/ },
    { value: sanitized.formattedEnd, field: 'formattedEnd', pattern: /^\d{8}$/ }
  ];

  const minMS = moment.tz('2023-01-01 00:00:00', 'Australia/Sydney').valueOf();
  const maxMS = moment.tz('2100-12-31 23:59:59.999', 'Australia/Sydney').valueOf();
  function isEpochMS(n: unknown): n is number{
    return typeof n === 'number'
    && Number.isInteger(n)
    && n >= minMS && n <= maxMS;
  }
  const startEpochMS = Number(startEpoch)
  const endEpochMS = Number(endEpoch)
  if (!isEpochMS(startEpochMS)) {return res.status(400).json({message: 'Start time must be bafter Jan 1 2023'})}
  if (!isEpochMS(endEpochMS)){return res.status(400).json({message: 'End time must be before Dec 31 2100'})}

  const errors: string[] = [];
  for (const rule of validators) {
    const { field, ok } = runRule(rule);
    if (!ok) errors.push(field);
  }

  if (errors.length) {
    return res.status(400).json({ message: `Invalid fields: ${errors.join(', ')}` });
  }

  req.body = {
    ...sanitized,
    startEpoch: startEpochMS,
    endEpoch: endEpochMS,
  };
  return next();
}

export function sanitizeIncidentCreation(req: Request, res: Response, next: NextFunction) {
  const {
    date,
    activID,
    incidentDescription
  } = req.body ?? {}; 
  
  
  const sanitized = {
    Date: validator.trim(String(date ?? "")),
    ActivID: validator.trim(String(activID ?? "")),
    IncidentDescription: validator.trim(String(incidentDescription ?? ""))
  };

  const errors: string[] = [];

  if (!sanitized.Date) {
    errors.push("Date is required");
  } else if (!/^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/.test(sanitized.Date)) {
    errors.push("Date must be in YYYY-MM-DD format");
  } else {
    const validDate = moment.tz(
      sanitized.Date,
      "YYYY-MM-DD",
      true,
      "Australia/Sydney"
    );

    if (!validDate.isValid()) {
      errors.push("Date is invalid");
    }
  }

  if (!sanitized.ActivID) {
    errors.push("Activity ID is required");
  } else if (!/^\d{2}-\d{1,8}$/.test(sanitized.ActivID)) {
    errors.push("Activity ID must be in the format 26-12345678");
  }

  if (!sanitized.IncidentDescription) {
    errors.push("Incident description is required");
  } else if (!/^[A-Za-z0-9\s,\.-]{1,50}$/.test(sanitized.IncidentDescription)) {
    errors.push("Incident description can only contain letters and numbers");
  }

  if (errors.length) {
    return res.status(400).json({
      message: `Invalid fields: ${errors.join(", ")}`
    });
  }
  req.body = {
    date: sanitized.Date,
    activID: sanitized.ActivID,
    incidentDescription: sanitized.IncidentDescription
  };

  return next();
}

export function sanitizeFireZoneNumber(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { numbers } = req.body;

  if (!Array.isArray(numbers) || numbers.length === 0) {
    res.status(400).json({ message: "Missing fire zone numbers" });
    return;
  }

  const sanitizedNumbers = numbers.map((number) =>
    validator.trim(String(number ?? ""))
  );

  const fireZoneRegex = /^\d{1,9}$/;

  const invalidNumbers = sanitizedNumbers.filter(
    (number) => !fireZoneRegex.test(number)
  );

  if (invalidNumbers.length > 0) {
    res.status(400).json({
      message: `Invalid fire zone numbers: ${invalidNumbers.join(", ")}`,
    });
    return;
  }

  req.body.numbers = sanitizedNumbers;

  next();
}

export function sanitizeEventDateQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const date = validator.trim(String(req.query.date ?? ""));

  if (!isValidEventDate(date)) {
    res.status(400).json({
      message: "Invalid event date. Use YYYY-MM-DD.",
    });
    return;
  }

  req.query.date = date;

  next();
}

export function sanitizeEventNumberQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const eventNumber = validator.trim(String(req.query.eventNumber ?? ""));

  if (!isValidEventNumber(eventNumber)) {
    res.status(400).json({
      message: "Invalid event number.",
    });
    return;
  }

  req.query.eventNumber = eventNumber;

  next();
}

export function sanitizeUpdateEventRolesBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const eventNumber = validator.trim(String(req.body.eventNumber ?? ""));
  const updates = req.body.updates;

  if (!isValidEventNumber(eventNumber)) {
    res.status(400).json({
      message: "Invalid event number.",
    });
    return;
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    res.status(400).json({
      message: "No role updates provided.",
    });
    return;
  }

  if (updates.length > 200) {
    res.status(400).json({
      message: "Too many role updates.",
    });
    return;
  }

  const sanitizedUpdates = updates.map((update) => ({
    recordId: validator.trim(String(update?.recordId ?? "")),
    roles: Array.isArray(update?.roles)
      ? update.roles
          .map((role: unknown) => validator.trim(String(role ?? "")))
          .filter(Boolean)
      : update?.roles,
  }));

  req.body.eventNumber = eventNumber;
  req.body.updates = sanitizedUpdates;

  next();
}

export function sanitizeRoleReportRunInput(
  req: Request,
  res: Response,
  next: NextFunction
) {
  sanitizeRoleReportBase(req, res, next, false);
}

export function sanitizeRoleReportExportInput(
  req: Request,
  res: Response,
  next: NextFunction
) {
  sanitizeRoleReportBase(req, res, next, true);
}

export function sanitizeCheckUsernameInput(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const username = validator.trim(String(req.body.username ?? ""));

  const usernameRegex = /^[A-Za-z]+(?:\.[A-Za-z]+)?(?:-[A-Za-z]+)?$/;

  if (
    username.length < 3 ||
    username.length > 40 ||
    !usernameRegex.test(username)
  ) {
    req.session.validUsername = undefined;

    res.status(400).json({
      ok: false,
      message: "Invalid username",
    });
    return;
  }

  req.body.username = username;

  next();
}

export function sanitizeUsernameListQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const query = validator.trim(String(req.query.q ?? "")).toLowerCase();

  if (query.length > 50) {
    res.status(400).json({
      message: "Search query too long.",
    });
    return;
  }

  const usernameSearchRegex = /^[a-z.-]*$/;

  if (!usernameSearchRegex.test(query)) {
    res.status(400).json({
      message: "Invalid username search query.",
    });
    return;
  }

  req.query.q = query;

  next();
}

export function sanitizeRoleAssignmentPinInput(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const pin = validator.trim(String(req.body.pin ?? ""));

  if (!/^\d{4}$/.test(pin)) {
    req.session.canAssignRoles = false;
    req.session.roleAssignmentUnlockedAt = undefined;

    res.status(400).json({
      ok: false,
      message: "Invalid PIN format.",
    });
    return;
  }

  req.body.pin = pin;

  next();
}