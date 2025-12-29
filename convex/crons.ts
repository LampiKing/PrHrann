import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Assign season awards",
  { hours: 1 },
  internal.leaderboard.assignSeasonAwardsCron
);

export default crons;
