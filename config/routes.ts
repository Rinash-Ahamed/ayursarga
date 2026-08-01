export const ROUTES = {
  public: {
    home: "/",
  },
  consumer: {
    home: "/app",
    login: "/app/login",
    register: "/app/register",
    forgotPassword: "/app/forgot-password",
  },
  hospital: {
    home: "/hospital",
    login: "/hospital/login",
    forgotPassword: "/hospital/forgot-password",
  },
  admin: {
    home: "/admin",
    login: "/admin/login",
    forgotPassword: "/admin/forgot-password",
  },
} as const;
