import { action } from "./_generated/server";
import { v } from "convex/values";

const stripDiacritics = (text: string) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const BRAND_WORDS = [
  "milka", "alpsko", "barilla", "nutella", "kinder", "oreo",
  "argeta", "zdenka", "fructal", "radenska", "coca", "pepsi", "fanta",
  "spar", "mercator", "tus", "tuš"
];

const CATEGORY_MAP: Array<{ key: string; triggers: string[] }> = [
  { key: "čokolada", triggers: ["coko", "cok", "cokolad", "cokolada", "cokoladne", "cokoladna", "cokoladni", "cokoladno", "čoko", "čokolad", "čokolada", "čokoladna"] },
  { key: "mleko", triggers: ["mleko", "mlecn", "mlek"] },
  { key: "sir", triggers: ["sir", "siri", "sira"] },
  { key: "jogurt", triggers: ["jogurt", "yogurt", "jog"] },
  { key: "maslo", triggers: ["maslo"] },
  { key: "sok", triggers: ["sok", "juice"] },
  { key: "voda", triggers: ["voda", "vode", "vodi", "water"] },
  { key: "čips", triggers: ["chips", "cips", "čips", "snack", "smoki", "flips"] },
];

function normalizeTokens(raw: string): { normalized: string; brandHint?: string; categoryHint?: string; suggestion?: string } {
  const norm = stripDiacritics(raw);
  if (!norm) return { normalized: "" };

  const tokens = norm.split(" ").filter(Boolean);

  // Detect brand
  const brandHint = tokens.find((t) => BRAND_WORDS.includes(t));

  // Detect category via triggers
  let categoryHint: string | undefined;
  for (const m of CATEGORY_MAP) {
    if (m.triggers.some((t) => tokens.some((w) => w.startsWith(t)))) {
      categoryHint = m.key;
      break;
    }
  }

  // Suggest replacement for common chocolate typos
  // e.g. "cokadna" -> add token "čokolada"
  let suggestedTokens = [...tokens];
  const hasChocolateNoise = tokens.some((t) => /^(cok|coko|cokolad.*)$/.test(t));
  if (hasChocolateNoise && !suggestedTokens.includes("cokolada")) {
    suggestedTokens = suggestedTokens.filter((t) => !/^cokolad.*$/.test(t) && !/^coko.*$/.test(t) && !/^cok$/.test(t));
    suggestedTokens.push("cokolada");
  }

  // If only brand provided (e.g., "milka"), keep it, but prefer ordering: brand + category if category exists
  const ordered = [] as string[];
  if (brandHint) ordered.push(brandHint);
  if (categoryHint && !ordered.includes(categoryHint)) ordered.push(categoryHint);
  for (const t of suggestedTokens) {
    if (!ordered.includes(t)) ordered.push(t);
  }

  const normalized = ordered.join(" ").trim();
  const suggestion = normalized !== norm ? normalized : undefined;
  return { normalized, brandHint, categoryHint, suggestion };
}

export const normalizeQuery = action({
  args: { query: v.string() },
  returns: v.object({
    normalizedQuery: v.string(),
    brandHint: v.optional(v.string()),
    categoryHint: v.optional(v.string()),
    suggestion: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const { normalized, brandHint, categoryHint, suggestion } = normalizeTokens(args.query);
    return {
      normalizedQuery: normalized,
      brandHint: brandHint || undefined,
      categoryHint: categoryHint || undefined,
      suggestion: suggestion || undefined,
    };
  },
});
