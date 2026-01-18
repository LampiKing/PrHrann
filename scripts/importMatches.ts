import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

interface MatchedProduct {
  store: string;
  name: string;
  price: string;
}

type MatchGroup = MatchedProduct[];

async function importMatches() {
  // Read matched products JSON
  const jsonPath = path.join(__dirname, "..", "matched_products.json");
  const jsonData = fs.readFileSync(jsonPath, "utf-8");
  const matchGroups: MatchGroup[] = JSON.parse(jsonData);

  console.log(`Loaded ${matchGroups.length} match groups`);

  // Initialize Convex client
  const convexUrl = process.env.CONVEX_URL || "https://vibrant-dolphin-871.convex.cloud";
  const client = new ConvexHttpClient(convexUrl);

  let processed = 0;
  let merged = 0;
  let errors = 0;

  for (const group of matchGroups) {
    if (group.length < 2) continue;

    // Get unique stores in this group
    const stores = new Set(group.map((p) => p.store));
    if (stores.size < 2) continue; // Need at least 2 different stores

    try {
      // Call the mergeByNames mutation
      const result = await client.mutation(api.mergeProducts.mergeByNames, {
        productNames: group.map((p) => ({
          store: p.store,
          name: p.name,
        })),
      });

      if (result.success) {
        merged += result.merged;
      }
    } catch (error) {
      errors++;
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`Processed ${processed}/${matchGroups.length} groups, merged ${merged} products, errors ${errors}`);
    }
  }

  console.log(`\nDone! Processed ${processed} groups, merged ${merged} products, errors ${errors}`);
}

importMatches().catch(console.error);
