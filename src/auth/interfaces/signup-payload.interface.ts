export interface SignupPayload {
  email: string;
  type: string;
  microsoftId?: string; // For Microsoft flow
  picture?: string; // For Google flow
  sub?: string; // Sometimes used
}
