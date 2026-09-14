import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "frederick-orders-defined-relax.trycloudflare.com",
    "perspectives-secretary-simply-street.trycloudflare.com",
  ],
  // Keep under experimental for Next 16; also raise proxy body for large forms.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
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
      {
        source: "/landing/terminos",
        destination: "/landing/terminos.html",
      },
      {
        source: "/landing/privacidad",
        destination: "/landing/privacidad.html",
      },
      {
        source: "/oldes-logo.svg",
        destination: "/landing/oldes-logo.svg",
      },
      {
        source: "/oldes-logo.png",
        destination: "/landing/oldes-logo.png",
      },
    ];
  },
};

export default nextConfig;
