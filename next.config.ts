import type { NextConfig } from "next";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.myacresapp.com/api";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/acres-api/:path*",
        destination: `${API_BASE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
