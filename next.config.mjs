import packageJson from "./package.json" with { type: "json" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    // Public build-time switch. No endpoint/polling is needed to decide visibility.
    NEXT_PUBLIC_AYU_ONLINE: process.env.AYU_ONLINE === "true" ? "true" : "false",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Retain dynamic optimization for photographic content, not pre-sized UI marks.
    deviceSizes: [640, 800, 1200, 1600, 1920],
    imageSizes: [64, 128, 256, 384],
    qualities: [75, 82],
    minimumCacheTTL: 2678400,
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [{
      source: "/optimized/:asset",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }, {
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
