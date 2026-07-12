import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Placeholder project thumbnails. Swap for real assets before launch.
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  devIndicators: false
};

export default nextConfig;
