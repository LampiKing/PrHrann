import { httpRouter } from "convex/server";
// import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Temporarily disabled auth routes until configuration is complete
// const auth = createAuth;
// authComponent.registerRoutes(http, auth, { cors: true });

export default http;
