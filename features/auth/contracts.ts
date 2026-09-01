export type PortalRole = "admin" | "hospital" | "consumer";

export type UserStatus = "active" | "inactive" | "pending" | "archived";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
};

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: PortalRole;
  status: UserStatus;
  hospitalId: string | null;
  privacyConsentAt: Date | null;
  privacyConsentVersion: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthSnapshot = {
  user: AuthUser | null;
  profile: UserProfile | null;
};

type AuthStateListener = (snapshot: AuthSnapshot) => void;

export interface AuthAdapter {
  login(credentials: LoginCredentials, expectedRole?: PortalRole): Promise<UserProfile>;
  loginConsumerWithGoogle(): Promise<UserProfile>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  getCurrentUser(): AuthUser | null;
  getCurrentProfile(force?: boolean): Promise<UserProfile | null>;
  subscribe(listener: AuthStateListener, onError: (error: Error) => void): () => void;
}
