import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { buildSitemap } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(getSiteUrl());
}
