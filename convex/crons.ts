import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Dodeli nagrade vsako uro (preveri če je konec sezone)
crons.interval(
  "Assign season awards",
  { hours: 1 },
  internal.leaderboard.assignSeasonAwardsCron
);

// Avtomatsko AI združevanje izdelkov - vsake 6 ur
crons.interval(
  "Auto merge products with AI",
  { hours: 6 },
  internal.smartMergeCron.runAutoMerge
);

// Preveri potekle akcije vsak dan ob 6:00 UTC
crons.daily(
  "Check expired sales",
  { hourUTC: 6, minuteUTC: 0 },
  internal.catalogManager.checkExpiredSales
);

export default crons;
