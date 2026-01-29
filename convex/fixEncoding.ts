import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Popravi napačen UTF-8 encoding v imenih izdelkov
 * Problem: "ČOKOLADNO" se prikaže kot "ÄŒOKOLADNO"
 * To se zgodi ko je UTF-8 napačno dekodiran kot ISO-8859-1
 */

// Mapa za popravek napačno kodiranih znakov
const ENCODING_FIXES: Record<string, string> = {
  // Velike črke
  "Ä\u008c": "Č",  // Č
  "ÄŒ": "Č",       // Č (alternativa)
  "Å½": "Ž",       // Ž
  "Å ": "Š",       // Š
  "Ä†": "Ć",       // Ć
  "Ä": "Đ",       // Đ
  
  // Male črke
  "Ä\u008d": "č",  // č
  "ÄŤ": "č",       // č (alternativa)
  "Å¾": "ž",       // ž
  "Å¡": "š",       // š
  "Ä‡": "ć",       // ć
  "Ä'": "đ",       // đ
  
  // Posebni znaki
  "Â´": "'",       // apostrof
  "Â ": " ",       // non-breaking space
  "â€"": "–",      // en-dash
  "â€™": "'",      // right single quote
  "â€œ": '"',      // left double quote
  "â€": '"',       // right double quote
};

function fixEncoding(text: string): string {
  if (!text) return text;
  
  let fixed = text;
  
  // Uporabi vse popravke
  for (const [broken, correct] of Object.entries(ENCODING_FIXES)) {
    fixed = fixed.split(broken).join(correct);
  }
  
  // Dodatni regex popravki za posebne primere
  // Ä + control char → Č ali č
  fixed = fixed.replace(/Ä[\x00-\x1f]/g, (match) => {
    const code = match.charCodeAt(1);
    if (code === 0x0c || code === 0x8c) return "Č";
    if (code === 0x0d || code === 0x8d) return "č";
    return match;
  });
  
  return fixed;
}

/**
 * Popravi encoding v vseh izdelkih (batch)
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
