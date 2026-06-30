import 'express-session';
import {Request} from "express"
import { Collection, Document } from "mongodb";

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    codeVerifier?: string;
    user?: {
      email: string;
      name: string;
      id?: string;
      isAdmin?: boolean;
    };
    canAssignRoles?: boolean;
    roleAssignmentUnlockedAt?: number;
    groups?: string[];
    token?: string;
    csrfToken?: string;
    validUsername?: string;
  }
}
declare global{
    interface AttendanceRecord {
    timestampLocal: string;
    operational: string;
    activity: string;
  }

  interface UserData {
    name: string;
    memberNumber: string;
    status: string;
    Membership_Classification: string;
    membership_type: string;
    operationalActivities: number;
    nonOperationalActivities: number;
    records: AttendanceRecord[];
  }
  export interface AuthedRequest extends Request {
  user?: {
    email: string;
    name: string;
    id?: string;
    isAdmin?: boolean;
  };
}
interface AzureTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface AzureProfile {
  mail?: string;
  userPrincipalName: string;
  displayName: string;
  id: string;
}

interface AzureGroupList {
  value: { id: string; displayName: string }[];
}

type CounterDocument = {
  _id: string;
  seq: number;
};

type EventServiceCollections = {
  eventsCollection: Collection<Document>;
  countersCollection: Collection<CounterDocument>;
};

type XlsxCellValue = string | number | boolean | Date | null | undefined;

type XlsxRow = XlsxCellValue[];

}