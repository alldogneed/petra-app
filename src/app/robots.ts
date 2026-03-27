import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/landing", "/register", "/login", "/pricing", "/accessibility", "/privacy", "/terms", "/book/"],
        disallow: [
          "/api/",
          "/admin/",
          "/owner/",
          "/dashboard",
          "/customers",
          "/appointments",
          "/payments",
          "/orders",
          "/leads",
          "/messages",
          "/analytics",
          "/settings",
          "/upgrade",
          "/checkout",
          "/payment/",
        ],
      },
    ],
    sitemap: "https://petra-app.com/sitemap.xml",
    host: "https://petra-app.com",
  };
}
