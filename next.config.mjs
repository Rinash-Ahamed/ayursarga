import packageJson from "./package.json" with { type: "json" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    // Public build-time switch. No endpoint/polling is needed to decide visibility.
    NEXT_PUBLIC_AYU_ONLINE: process.env.AYU_ONLINE === "true" ? "true" : "false",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 82, 90],
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        // Baseline restrictions do not change script/style loading or force
        // dynamic rendering. A full script policy needs auth/payment testing.
        { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
