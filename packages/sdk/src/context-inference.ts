import type { BadgeVisitContext } from "./types.js";

export function inferContextFromUrl(url: string): BadgeVisitContext {
  try {
    const segments = new URL(url).pathname.toLowerCase().split("/");
    if (segments.includes("checkout")) return "checkout";
    if (segments.includes("cart")) return "addtocart";
  } catch {
    return "arrival";
  }
  return "arrival";
}
