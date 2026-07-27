import type { NextConfig } from "next";

/**
 * Every screen in this app is a dynamic route: each one reads the session
 * cookie and then asks PocketBase, which lives on another host, so a page
 * change costs a server round trip plus however many database calls that page
 * makes. Next.js does not cache dynamic segments in the browser by default —
 * `dynamic` ships as 0 — which means walking Thoughts → Tags → Thoughts pays
 * that bill three times for data that is almost always identical.
 *
 * So the client keeps them. A revisit inside the window renders from what the
 * browser already has, with no request at all, and `FreshData` quietly asks the
 * server for a newer copy behind the already-painted screen. Stale for a moment
 * beats blank for a second, and nothing here is a number you would be hurt by
 * seeing a minute late — a thought you just wrote is put on screen by the
 * screen that wrote it, not discovered by a poll.
 *
 * `static` covers routes prefetched in full, which is what the rail's links now
 * ask for; `dynamic` covers everything reached another way.
 */
const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
};

export default nextConfig;
