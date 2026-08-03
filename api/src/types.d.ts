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
    validUsernames?: string[];
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

type XlsxValue = string | number | boolean | Date;

type XlsxStyledCell = {
  value: XlsxValue;
  type?: StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor | "Formula";
  format?: string;

  fontWeight?: "bold";
  fontStyle?: "italic";
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;

  align?: "left" | "center" | "right";
  alignVertical?: "top" | "center" | "bottom";
  indent?: number;
  wrap?: boolean;
};

type XlsxCell = XlsxValue | XlsxStyledCell | null | undefined;
type XlsxRow = XlsxCell[];

}