export const ROUTES = {
  public: {
    home: "/",
  },
  consumer: {
    home: "/app",
    bookings: "/app/bookings",
    profile: "/app/profile",
    login: "/app/login",
    register: "/app/register",
    forgotPassword: "/app/forgot-password",
  },
  hospital: {
    home: "/hospital",
    profile: "/hospital/profile",
    services: "/hospital/services",
    bookings: "/hospital/bookings",
    login: "/hospital/login",
    forgotPassword: "/hospital/forgot-password",
  },
  admin: {
    home: "/admin",
    hospitals: "/admin/hospitals",
    users: "/admin/users",
    bookings: "/admin/bookings",
    login: "/admin/login",
    forgotPassword: "/admin/forgot-password",
  },
} as const;
