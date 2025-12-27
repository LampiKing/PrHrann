import { httpRouter } from "convex/server";
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

// Configure auth routes with proper CORS for localhost development
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: localhostPorts,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
});

export default http;
