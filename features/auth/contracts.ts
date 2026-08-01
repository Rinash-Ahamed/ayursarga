export type PortalRole = "admin" | "hospital" | "consumer";

export type UserStatus = "active" | "inactive" | "pending";

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
  role: PortalRole;
  status: UserStatus;
  hospitalId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type ConsumerRegistration = LoginCredentials & {
  name: string;
  phone?: string;
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
  getCurrentUser(): AuthUser | null;
  getCurrentProfile(force?: boolean): Promise<UserProfile | null>;
  subscribe(listener: AuthStateListener, onError: (error: Error) => void): () => void;
}
