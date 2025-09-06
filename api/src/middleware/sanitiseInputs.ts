import { Request, Response, NextFunction } from 'express';
import moment from 'moment';
import validator from 'validator';
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
    otherType
  } = req.body;

  const sanitized = {
    name: validator.trim(name || ''),
    operational: validator.trim(operational || ''),
    activity: validator.trim(activity || ''),
    baType: validator.trim(baType || ''),
    chainsawType: validator.trim(chainsawType || ''),
    deploymentType: validator.trim(deploymentType || ''),
    deploymentLocation: validator.trim(deploymentLocation || ''),
    otherType: validator.trim(otherType || '')
  };

  const validators = [
    { value: sanitized.name, pattern: /^[a-zA-Z0-9\s-]+$/, field: 'name' },
    { value: sanitized.operational, pattern: /^[a-zA-Z0-9\s-]+$/, field: 'operational' },
    { value: sanitized.activity, pattern: /^[a-zA-Z0-9\s-]+$/, field: 'activity' },
    { value: sanitized.baType, pattern: /^[a-zA-Z0-9\s]+$/, field: 'baType' },
    { value: sanitized.chainsawType, pattern: /^[a-zA-Z0-9\s]+$/, field: 'chainsawType' },
    { value: sanitized.deploymentType, pattern: /^[a-zA-Z0-9\s]+$/, field: 'deploymentType' },
    { value: sanitized.deploymentLocation, pattern: /^[a-zA-Z0-9\s]+$/, field: 'deploymentLocation' },
    { value: sanitized.otherType, pattern: /^[a-zA-Z0-9\s\.,\-\']+$/, field: 'otherType'}
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
    { value: sanitized.oldname, pattern: /^[a-zA-Z-\s]+$/, field: 'Old Name' },
    { value: sanitized.name, pattern: /^[a-zA-Z-\s]+$/, field: 'Name' },
    { value: sanitized.oldfzNumber, pattern: /^\d{1,9}?$/, field: 'Old Firezone Number' },
    { value: sanitized.fzNumber, pattern: /^\d{1,9}?$/, field: 'FireZone Number' },
    { value: sanitized.memberStatus, pattern: /^[a-zA-Z]+\(?[a-zA-Z]+\)?$/, field: 'Membership Status' },
    { value: sanitized.memberClassification, pattern: /^[a-zA-Z]+$/, field: 'Membership Classification' },
    { value: sanitized.memberType, pattern: /^[a-zA-Z\s]+$/, field: 'Membership Type' }
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
    { value: sanitized.firstName, pattern: /^[a-zA-Z-]+$/, field: 'First Name' },
    { value: sanitized.lastName, pattern: /^[a-zA-Z-]+$/, field: 'Last Name' },
    { value: sanitized.fireZoneNumber, pattern: /^\d{1,9}?$/, field: 'Firezone Number' },
    { value: sanitized.Status, pattern: /^[a-zA-Z]+\(?[a-zA-Z]+\)?$/, field: 'Membership Status' },
    { value: sanitized.Classification, pattern: /^[a-zA-Z]+$/, field: 'Membership Classification' },
    { value: sanitized.Type, pattern: /^[a-zA-Z\s]+$/, field: 'Membership type' }
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
    operational
  } = req.body ?? {};

  const asTrimmedString = (v: unknown) => validator.trim(String(v ?? ''));

  const sanitized = {
    name: asTrimmedString(name),
    operational: asTrimmedString(operational),
    activity: asTrimmedString(activity),
  };

  const validators = [
    { value: sanitized.name,               pattern: /^[a-zA-Z0-9\s-]+$/,  field: 'name' },
    { value: sanitized.operational,        pattern: /^[a-zA-Z0-9\s-]+$/,  field: 'operational' },
    { value: sanitized.activity,           pattern: /^[a-zA-Z0-9\s-]+$/,  field: 'activity' },
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
  if (!isEpochMS(startEpochMS)) {return res.status(400).json({message: 'Start time must be bafter Jan 1 2023'})}
  if (!isEpochMS(endEpochMS)){return res.status(400).json({message: 'End time must be before Dec 31 2100'})}
    req.body = {
    ...sanitized,
    startEpoch: startEpochMS,
    endEpoch: endEpochMS,
  };

  return next();
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
export function sanitizeReportingExportInput(req: Request, res: Response, next: NextFunction) {
  const {
    startEpoch,
    endEpoch,
    name,
    activity,
    operational,
    includeZeroAttendance,
    detailed,
    formattedStart,
    formattedEnd
  } = req.body ?? {};

  const sanitized = {
    name: validator.trim(String(name ?? '')),
    operational: validator.trim(String(operational ?? '')),
    activity: validator.trim(String(activity ?? '')),
    formattedStart: validator.trim(String(formattedStart ?? '')),
    formattedEnd: validator.trim(String(formattedEnd ?? '')),

    includeZeroAttendance: parseBoolean(includeZeroAttendance),
    detailed: parseBoolean(detailed),
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

    { value: sanitized.name, field: 'name', pattern: /^[a-zA-Z0-9\s-]*$/ },
    { value: sanitized.operational, field: 'operational', pattern: /^[a-zA-Z0-9\s-]*$/ },
    { value: sanitized.activity, field: 'activity', pattern: /^[a-zA-Z0-9\s-]*$/ },

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