export interface MicrosoftJwtPayload {
  aud?: string;
  iss?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  aio?: string;
  name?: string;
  oid?: string; // Object ID (User ID)
  preferred_username?: string; // Email usually
  rh?: string;
  sub?: string;
  tid?: string;
  uti?: string;
  ver?: string;
  email?: string;
}
