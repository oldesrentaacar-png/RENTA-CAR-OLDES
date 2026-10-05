import type { MetadataRoute } from "next";

const SITE = "https://oldescarrentalelsalvador.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing/"],
        disallow: ["/dashboard/", "/login", "/api/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
