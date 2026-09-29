import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { buildRobots } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(getSiteUrl());
}
