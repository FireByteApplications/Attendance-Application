import 'express-session';
import {Request} from "express"

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
}