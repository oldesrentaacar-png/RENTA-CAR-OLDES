import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "frederick-orders-defined-relax.trycloudflare.com",
    "perspectives-secretary-simply-street.trycloudflare.com",
  ],
  async rewrites() {
    return [
      {
        source: "/landing",
        destination: "/landing/index.html",
      },
      {
        source: "/landing/",
        destination: "/landing/index.html",
      },
      {
        source: "/landing/faq",
        destination: "/landing/faq.html",
      },
    ];
  },
};

export default nextConfig;
