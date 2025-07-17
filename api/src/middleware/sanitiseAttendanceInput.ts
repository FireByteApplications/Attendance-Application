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
