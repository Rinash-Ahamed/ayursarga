export const ROUTES = {
  public: {
    home: "/",
  },
  consumer: {
    home: "/app",
    login: "/app/login",
  },
  hospital: {
    home: "/hospital",
    login: "/hospital/login",
  },
  admin: {
    home: "/admin",
    login: "/admin/login",
  },
} as const;
