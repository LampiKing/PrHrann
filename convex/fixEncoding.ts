import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Popravi napačen UTF-8 encoding v imenih izdelkov
 * Problem: "ČOKOLADNO" se prikaže kot "ÄŒOKOLADNO"
 * To se zgodi ko je UTF-8 napačno dekodiran kot ISO-8859-1
 */

// Mapa za popravek napačno kodiranih znakov
const ENCODING_FIXES: [string, string][] = [
  // Velike črke
  ["\u00c4\u008c", "Č"],     // Č
  ["\u00c4\u0152", "Č"],     // Č (alternativa)
  ["\u00c5\u00bd", "Ž"],     // Ž
  ["\u00c5\u00a0", "Š"],     // Š
  ["\u00c4\u2020", "Ć"],     // Ć
  
  // Male črke
  ["\u00c4\u008d", "č"],     // č
  ["\u00c4\u0165", "č"],     // č (alternativa)
  ["\u00c5\u00be", "ž"],     // ž
  ["\u00c5\u00a1", "š"],     // š
  ["\u00c4\u2021", "ć"],     // ć
  
  // Posebni znaki
  ["\u00c2\u00b4", "'"],     // apostrof
  ["\u00c2\u00a0", " "],     // non-breaking space
];

function fixEncoding(text: string): string {
  if (!text) return text;
  
  let fixed = text;
  
  // Uporabi vse popravke iz array-a
  for (const [broken, correct] of ENCODING_FIXES) {
    fixed = fixed.split(broken).join(correct);
  }
  
  // Dodatni regex popravki za posebne primere
  // Ä + control char → Č ali č
  fixed = fixed.replace(/\u00c4[\x00-\x1f\x80-\x9f]/g, (match) => {
    const code = match.charCodeAt(1);
    if (code === 0x0c || code === 0x8c) return "Č";
    if (code === 0x0d || code === 0x8d) return "č";
    return match;
  });
  
  // Å + special char → Š, Ž, š, ž
  fixed = fixed.replace(/\u00c5[\x00-\xff]/g, (match) => {
    const code = match.charCodeAt(1);
    if (code === 0xbd) return "Ž";
    if (code === 0xa0) return "Š";
    if (code === 0xbe) return "ž";
    if (code === 0xa1) return "š";
    return match;
  });
  
  return fixed;
}

/**
 * Popravi encoding v vseh izdelkih (batch) - PUBLIC verzija za CLI
 */
export const runEncodingFix = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    fixed: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 500;
    
    // Pridobi izdelke
    const products = await ctx.db
      .query("products")
      .take(batchSize);
    
    let fixed = 0;
    
    for (const product of products) {
      const originalName = product.name;
      const fixedName = fixEncoding(originalName);
      
      if (fixedName !== originalName) {
        await ctx.db.patch(product._id, {
          name: fixedName,
        });
        fixed++;
      }
    }
    
    // Preštej preostale - sampling namesto polnega pregleda
    const sampleProducts = await ctx.db.query("products").take(1000);
    const remaining = sampleProducts.filter(p => {
      const fixedName = fixEncoding(p.name);
      return fixedName !== p.name;
    }).length;
    
    return { processed: products.length, fixed, remaining };
  },
});

/**
 * Popravi encoding v vseh izdelkih (batch) - INTERNAL verzija
 */
export const fixProductEncoding = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    fixed: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 500;
    
    // Pridobi izdelke ki morda imajo encoding probleme
    const products = await ctx.db
      .query("products")
      .take(batchSize);
    
    let fixed = 0;
    
    for (const product of products) {
      const originalName = product.name;
      const fixedName = fixEncoding(originalName);
      
      // Če se je ime spremenilo, posodobi
      if (fixedName !== originalName) {
        await ctx.db.patch(product._id, {
          name: fixedName,
        });
        fixed++;
        console.log(`[fixEncoding] "${originalName}" → "${fixedName}"`);
      }
    }
    
    // Preštej preostale
    const allProducts = await ctx.db.query("products").collect();
    const remaining = allProducts.filter(p => {
      const fixedName = fixEncoding(p.name);
      return fixedName !== p.name;
    }).length;
    
    return {
      processed: products.length,
      fixed,
      remaining,
    };
  },
});

/**
 * Ročno popravi en izdelek
 */
export const fixSingleProduct = internalMutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    
    const fixedName = fixEncoding(product.name);
    
    if (fixedName !== product.name) {
      await ctx.db.patch(product._id, { name: fixedName });
      return { before: product.name, after: fixedName };
    }
    
    return { before: product.name, after: product.name, noChange: true };
  },
});
