export const ROUTES = {
  public: {
    home: "/",
  },
  consumer: {
    home: "/app",
    bookings: "/app/bookings",
    profile: "/app/profile",
    completeProfile: "/app/complete-profile",
    login: "/app/login",
    register: "/app/register",
    forgotPassword: "/app/forgot-password",
  },
  hospital: {
    home: "/hospital",
    profile: "/hospital/profile",
    services: "/hospital/services",
    bookings: "/hospital/bookings",
    changePassword: "/hospital/change-password",
    login: "/hospital/login",
    forgotPassword: "/hospital/forgot-password",
  },
  admin: {
    home: "/admin",
    hospitals: "/admin/hospitals",
    users: "/admin/users",
    bookings: "/admin/bookings",
    audits: "/admin/audits",
    login: "/admin/login",
    forgotPassword: "/admin/forgot-password",
  },
} as const;
