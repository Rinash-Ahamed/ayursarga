/** Provider-neutral auth contracts for the future Ayursarga portals. */
export type PortalRole = "admin" | "hospital" | "consumer";

export type AuthSession = {
  userId: string;
  role: PortalRole;
  expiresAt: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export interface AuthAdapter {
  getSession(): Promise<AuthSession | null>;
  login(credentials: LoginCredentials, role: PortalRole): Promise<AuthSession>;
  logout(): Promise<void>;
}
