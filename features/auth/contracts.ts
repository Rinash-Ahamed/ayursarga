export type PortalRole = "admin" | "hospital" | "consumer";

export type UserStatus = "active" | "pending" | "suspended";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: PortalRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  userId: string;
  role: PortalRole;
  expiresAt: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type ConsumerRegistration = LoginCredentials & {
  displayName: string;
};

export type AuthSnapshot = {
  user: AuthUser | null;
  profile: UserProfile | null;
};

export type AuthStateListener = (snapshot: AuthSnapshot) => void;

export interface AuthAdapter {
  login(credentials: LoginCredentials, expectedRole?: PortalRole): Promise<UserProfile>;
  registerConsumer(input: ConsumerRegistration): Promise<UserProfile>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getCurrentProfile(): Promise<UserProfile | null>;
  subscribe(listener: AuthStateListener, onError: (error: Error) => void): () => void;
}
