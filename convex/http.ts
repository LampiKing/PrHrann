import { httpActionGeneric, httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Generate localhost URLs for ports 3000-9000 and common Expo ports
const localhostPorts = [
  ...Array.from({ length: 100 }, (_, i) => `http://localhost:${8000 + i}`),
  ...Array.from({ length: 100 }, (_, i) => `http://127.0.0.1:${8000 + i}`),
  ...Array.from({ length: 100 }, (_, i) => `http://localhost:${19000 + i}`),
  ...Array.from({ length: 100 }, (_, i) => `http://127.0.0.1:${19000 + i}`),
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const normalizeUrl = (value?: string) => value?.trim().replace(/\/$/, "");
const isString = (value?: string | null): value is string => Boolean(value);
const fallbackSiteUrl = "https://www.prhran.com";
const rawSiteUrl = normalizeUrl(
  process.env.SITE_URL ||
    process.env.EXPO_PUBLIC_SITE_URL ||
    fallbackSiteUrl
) || fallbackSiteUrl;
const siteUrl = rawSiteUrl.includes(".convex.cloud")
  ? rawSiteUrl.replace(".convex.cloud", ".convex.site")
  : rawSiteUrl;
const prodOrigins = [
  "https://prhran.com",
  "https://www.prhran.com",
  "https://prhrannn.netlify.app",
  fallbackSiteUrl,
].map(normalizeUrl).filter(isString);
const allowedOrigins = Array.from(
  new Set([siteUrl, ...localhostPorts, ...prodOrigins].filter(isString))
);

// Configure auth routes with proper CORS for web + localhost development
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Better-Auth-Cookie",
      "Set-Better-Auth-Cookie",
    ],
  },
});

http.route({
  path: "/api/ingest/grocery",
  method: "POST",
  handler: httpActionGeneric(async (ctx, request) => {
    const expectedToken = process.env.PRHRAN_INGEST_TOKEN;
    if (!expectedToken) {
      return new Response("Ingest token not configured", { status: 500 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (token !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: any = null;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const items = payload?.izdelki || payload?.items || [];
    if (!Array.isArray(items)) {
      return new Response("Missing items", { status: 400 });
    }

    const result = await ctx.runMutation(
      internal.groceryImport.importFromScanner,
      { items }
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
