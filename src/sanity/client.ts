import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.replace(/"/g, "");
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.replace(/"/g, "");
const apiVersion = (process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-05-15").replace(/"/g, "");

export const warehouseClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production",
});