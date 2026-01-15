/**
 * Script za uvoz primerjav cen v Convex
 * Prebere matched_products.csv in shrani v Convex
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

interface PriceComparison {
  canonicalName: string;
  sparPrice?: number;
  mercatorPrice?: number;
  tusPrice?: number;
  cheapestStore: string;
  priceDifference: number;
}

function parsePrice(priceStr: string): number | undefined {
  if (!priceStr || priceStr.trim() === "") return undefined;
  const cleaned = priceStr.replace(",", ".").replace(/[^\d.]/g, "");
  const price = parseFloat(cleaned);
  return isNaN(price) ? undefined : price;
}

async function importPriceComparisons() {
  // Preberi CSV
  const csvPath = path.join(__dirname, "..", "matched_products.csv");

  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found:", csvPath);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((line) => line.trim());

  // Preskoči header
  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} price comparisons`);

  const comparisons: PriceComparison[] = [];

  for (const line of dataLines) {
    // Parse CSV from the END (prices are always last 5 columns)
    // Format: PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
    const parts = line.split(",");
    if (parts.length < 6) continue;

    // Zadnjih 5 stolpcev je vedno cene in trgovina
    const priceDifference = parsePrice(parts[parts.length - 1]) || 0;
    const cheapestStore = parts[parts.length - 2].trim();
    const tusPrice = parsePrice(parts[parts.length - 3]);
    const mercatorPrice = parsePrice(parts[parts.length - 4]);
    const sparPrice = parsePrice(parts[parts.length - 5]);

    // Vse ostalo je ime izdelka (lahko vsebuje vejice)
    const canonicalName = parts.slice(0, parts.length - 5).join(",").trim();

    if (!canonicalName) continue;

    comparisons.push({
      canonicalName,
      sparPrice,
      mercatorPrice,
      tusPrice,
      cheapestStore,
      priceDifference,
    });
  }

  console.log(`Parsed ${comparisons.length} valid comparisons`);

  // Pošlji v Convex
  const convexUrl =
    process.env.CONVEX_URL || "https://vibrant-dolphin-871.convex.cloud";
  const client = new ConvexHttpClient(convexUrl);

  try {
    const result = await client.mutation(
      api.priceComparison.saveMatchedProducts,
      {
        matches: comparisons,
      }
    );

    console.log(`Successfully imported ${result.inserted} price comparisons`);
  } catch (error) {
    console.error("Error importing to Convex:", error);
    process.exit(1);
  }
}

importPriceComparisons();
