import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /// Admins can paste ANY external image URL for logo, hero, dishes,
    /// categories, gallery and about — Next.js must be allowed to proxy them.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
