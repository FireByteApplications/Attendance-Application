import { Request, Response, NextFunction } from 'express';
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
    { value: sanitized.name, pattern: /^[a-zA-Z0-9\s]+$/, field: 'name' },
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
    { value: sanitized.oldname, pattern: /^[a-zA-Z-]+$/, field: 'Old Name' },
    { value: sanitized.name, pattern: /^[a-zA-Z-]+$/, field: 'Name' },
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

