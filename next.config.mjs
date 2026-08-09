import packageJson from "./package.json" with { type: "json" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 82, 90],
  },
};

export default nextConfig;
