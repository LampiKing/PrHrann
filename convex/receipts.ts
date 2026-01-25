import { v } from "convex/values";
import { action } from "./_generated/server";
import { authMutation, authQuery } from "./functions";
import { api } from "./_generated/api";
import { sendAdminNotification } from "./notify";
import { getDateKey, getEndOfDayTimestamp, getSeasonYear, isWithinSeason } from "./time";
import { Id } from "./_generated/dataModel";

type ParsedReceiptItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
};

type ParsedReceipt = {
  storeName?: string;
  purchaseDate?: string; // YYYY-MM-DD
  purchaseTime?: string; // HH:MM
  totalPaid: number;
  currency?: string;
  items: ParsedReceiptItem[];
};

type ReceiptItemMatch = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  matchedProductId?: Id<"products">;
  matchScore?: number;
  referenceUnitPrice?: number;
};

type ReceiptActionResult = {
  success: boolean;
  receiptId?: Id<"receipts">;
  error?: string;
  invalidReason?: string;
  savedAmount?: number;
  storeName?: string;
  totalPaid?: number;
};

const MAX_RECEIPTS_FREE = 2;
const MAX_RECEIPTS_FAMILY = 4;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Znane blagovne znamke za boljše ujemanje
const KNOWN_BRANDS = new Set([
  "milka", "jaffa", "coca", "cola", "pepsi", "fanta", "sprite",
  "alpsko", "mu", "ego", "zott", "danone", "activia",
  "barilla", "knorr", "podravka", "vegeta", "argeta",
  "nutella", "ferrero", "kinder", "mars", "snickers", "twix",
  "lindt", "toblerone", "nivea", "dove", "colgate",
  "radenska", "donat", "jana", "nescafe", "jacobs", "barcaffe",
]);

// Izvleči brand iz imena
function extractBrand(name: string): string | null {
  const normalized = normalizeText(name);
  for (const brand of KNOWN_BRANDS) {
    if (normalized.includes(brand)) return brand;
  }
  return null;
}

// Izvleči velikost (gramatura/volumen)
function extractSize(name: string): string | null {
  const normalized = normalizeText(name);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl)/i);
  if (!match) return null;
  const value = parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  // Normaliziraj v osnovne enote
  if (unit === "g") return `${value}g`;
  if (unit === "kg") return `${value * 1000}g`;
  if (unit === "ml") return `${value}ml`;
  if (unit === "l") return `${value * 1000}ml`;
  if (unit === "cl") return `${value * 10}ml`;
  if (unit === "dl") return `${value * 100}ml`;
  return `${value}${unit}`;
}

// IZBOLJŠAN scoreMatch - upošteva brand in velikost
function scoreMatch(itemName: string, productName: string): number {
  const itemNorm = normalizeText(itemName);
  const productNorm = normalizeText(productName);

  // Izvleči brand in velikost
  const itemBrand = extractBrand(itemName);
  const productBrand = extractBrand(productName);
  const itemSize = extractSize(itemName);
  const productSize = extractSize(productName);

  // BONUS: Isti brand + ista velikost = zelo verjeten match
  if (itemBrand && productBrand && itemBrand === productBrand) {
    if (itemSize && productSize && itemSize === productSize) {
      return 0.9; // 90% match - isti brand + velikost
    }
    return 0.6; // 60% match - isti brand
  }

  // Standardna primerjava tokenov
  const itemTokens = itemNorm.split(" ").filter(Boolean);
  const productTokens = productNorm.split(" ").filter(Boolean);
  if (itemTokens.length === 0 || productTokens.length === 0) return 0;

  const productSet = new Set(productTokens);
  const overlap = itemTokens.filter((token) => productSet.has(token)).length;
  const baseScore = overlap / Math.max(itemTokens.length, productTokens.length);

  // Bonus za ujemanje velikosti (tudi če brand ni znan)
  if (itemSize && productSize && itemSize === productSize) {
    return Math.min(1, baseScore + 0.2);
  }

  return baseScore;
}

function getReceiptFingerprint(storeNameLower: string, dateKey: string, totalPaid: number): string {
  const total = totalPaid.toFixed(2);
  return `${storeNameLower}|${dateKey}|${total}`;
}

function parsePurchaseDate(dateString?: string): { dateKey?: string; timestamp?: number } {
  if (!dateString) return {};
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return {};
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!year || !month || !day) return {};
  const timestamp = Date.UTC(year, month - 1, day, 12, 0, 0);
  const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
  return { dateKey, timestamp };
}

const RECEIPT_SYSTEM_PROMPT = "You are an expert OCR system for grocery receipts. Extract receipt data from ANY format: physical receipts, digital receipts, screenshots, emails, PDFs, or virtual receipts. Focus on ESSENTIAL information only: store name (Mercator, Spar, Tuš), date, time, total amount, and itemized list. Return ONLY valid JSON with keys: storeName, purchaseDate (YYYY-MM-DD), purchaseTime (HH:MM), totalPaid (number), currency (string), items (array of {name, quantity, unitPrice, lineTotal}). If missing, use null for strings and 0 for numbers. Items array can be empty if not visible. Be flexible with formats - accept e-receipts, loyalty app screenshots, and virtual receipts. Prioritize accuracy over completeness.";

const RECEIPT_USER_PROMPT = "Extract essential receipt data from this image. Accept any format: physical receipt, digital receipt, screenshot, email, or virtual receipt. Focus on store name, date, time, total, and items.";

function parseReceiptResponse(content: string): ParsedReceipt | null {
  try {
    // Try to extract JSON from the response (might be wrapped in markdown)
    let jsonStr = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to find JSON object directly
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr) as ParsedReceipt;
    if (!parsed || typeof parsed.totalPaid !== "number") return null;
    return {
      storeName: parsed.storeName || undefined,
      purchaseDate: parsed.purchaseDate || undefined,
      purchaseTime: parsed.purchaseTime || undefined,
      totalPaid: parsed.totalPaid,
      currency: parsed.currency || undefined,
      items: Array.isArray(parsed.items) ? parsed.items.filter((item) => item?.name) : [],
    };
  } catch {
    return null;
  }
}

// OpenAI GPT-4o za prepoznavanje računov
async function parseReceiptWithOpenAI(imageBase64: string): Promise<ParsedReceipt | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: RECEIPT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: RECEIPT_USER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.log("OpenAI error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    return parseReceiptResponse(content);
  } catch (error) {
    console.log("OpenAI exception:", error);
    return null;
  }
}

// Main parser - tries Groq (free) first, then OpenAI
async function parseReceipt(imageBase64: string): Promise<ParsedReceipt | null> {
  // Uporabi OpenAI GPT-4o za prepoznavanje računov
  const result = await parseReceiptWithOpenAI(imageBase64);
  if (result) {
    console.log("Receipt parsed with OpenAI");
    return result;
  }

  console.log("No API key available for receipt parsing");
  return null;
}

export const submitReceipt = action({
  args: {
    imageBase64: v.string(),
    imageBase64Bottom: v.optional(v.string()), // Optional second image for long receipts
    confirmed: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    receiptId: v.optional(v.id("receipts")),
    error: v.optional(v.string()),
    invalidReason: v.optional(v.string()),
    savedAmount: v.optional(v.number()),
    storeName: v.optional(v.string()),
    totalPaid: v.optional(v.number()),
  }),
  handler: async (ctx, args): Promise<ReceiptActionResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Authentication required." };
    }

    // Parse primary image (top or single)
    const parsedTop = await parseReceipt(args.imageBase64);
    if (!parsedTop) {
      return { success: false, error: "Račun ni bil prepoznan. Preveri če imaš nastavljeno GROQ_API_KEY ali OPENAI_API_KEY." };
    }

    // If we have a second image (bottom part of long receipt), parse and merge
    let finalParsed = parsedTop;
    if (args.imageBase64Bottom) {
      const parsedBottom = await parseReceipt(args.imageBase64Bottom);
      if (parsedBottom) {
        // Merge results: use top for store/date info, combine items, use bottom for total
        finalParsed = {
          storeName: parsedTop.storeName || parsedBottom.storeName,
          purchaseDate: parsedTop.purchaseDate || parsedBottom.purchaseDate,
          purchaseTime: parsedTop.purchaseTime || parsedBottom.purchaseTime,
          // Use bottom total as it's more likely to be the final total
          totalPaid: parsedBottom.totalPaid > 0 ? parsedBottom.totalPaid : parsedTop.totalPaid,
          currency: parsedTop.currency || parsedBottom.currency,
          // Combine items from both images
          items: [...parsedTop.items, ...parsedBottom.items],
        };
      }
    }

    const result: ReceiptActionResult = await ctx.runMutation(api.receipts.createReceipt, {
      parsed: finalParsed,
      confirmed: args.confirmed,
    });

    return result;
  },
});

export const createReceipt = authMutation({
  args: {
    parsed: v.object({
      storeName: v.optional(v.string()),
      purchaseDate: v.optional(v.string()),
      purchaseTime: v.optional(v.string()),
      totalPaid: v.number(),
      currency: v.optional(v.string()),
      items: v.array(
        v.object({
          name: v.string(),
          quantity: v.optional(v.number()),
          unitPrice: v.optional(v.number()),
          lineTotal: v.optional(v.number()),
        })
      ),
    }),
    confirmed: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    receiptId: v.optional(v.id("receipts")),
    error: v.optional(v.string()),
    invalidReason: v.optional(v.string()),
    savedAmount: v.optional(v.number()),
    storeName: v.optional(v.string()),
    totalPaid: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const now = Date.now();
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found." };
    }

    const isGuest = profile.isAnonymous || !profile.email;
    if (isGuest) {
      return { success: false, error: "Guests cannot add receipts." };
    }

    const groupId = profile.familyOwnerId || userId;
    const todayKey = getDateKey(now);
    const storeName = args.parsed.storeName?.trim() || "Unknown";
    const storeNameLower = storeName.toLowerCase();
    const totalPaid = Math.max(0, args.parsed.totalPaid);

    const parsedDateInfo = parsePurchaseDate(args.parsed.purchaseDate);
    const purchaseDateKey = parsedDateInfo.dateKey || todayKey;
    const purchaseDateTimestamp = parsedDateInfo.timestamp ?? now;
    const receiptFingerprint = getReceiptFingerprint(storeNameLower, purchaseDateKey, totalPaid);

    const limit = profile.premiumType === "family" ? MAX_RECEIPTS_FAMILY : MAX_RECEIPTS_FREE;
    const receiptsToday = await ctx.db
      .query("receipts")
      .withIndex("by_group_and_date", (q) => q.eq("groupId", groupId).eq("purchaseDateKey", purchaseDateKey))
      .collect();
    if (receiptsToday.length >= limit) {
      return { success: false, error: "Daily receipt limit reached." };
    }

    const duplicate = await ctx.db
      .query("receipts")
      .withIndex("by_group_and_fingerprint", (q) =>
        q.eq("groupId", groupId).eq("receiptFingerprint", receiptFingerprint)
      )
      .first();
    if (duplicate) {
      return { success: false, error: "Duplicate receipt detected." };
    }

    const endOfDay = getEndOfDayTimestamp(now);
    const isSameDay = purchaseDateKey === todayKey;
    const isBeforeCutoff = now <= endOfDay;
    const hasDate = !!args.parsed.purchaseDate && !!parsedDateInfo.dateKey;
    const allowedStores = ["spar", "interspar", "mercator", "tus", "tuš"];
    const isAllowedStore = allowedStores.some(s => storeNameLower.includes(s));
    let invalidReason: string | undefined;

    if (!args.confirmed) {
      invalidReason = "Račun ni bil potrjen.";
    } else if (!hasDate) {
      invalidReason = "Datum računa ni bil prepoznan. Prosim naloži bolj jasno sliko.";
    } else if (!isAllowedStore) {
      invalidReason = `Neznana trgovina: ${storeName}. Podprte so: Mercator, Spar, Tuš.`;
    } else if (!isSameDay) {
      invalidReason = `Račun ni od danes (${purchaseDateKey}). Za tekmovanje štejejo samo današnji računi.`;
    } else if (!isBeforeCutoff) {
      invalidReason = "Račun oddan po 23:00. Poskusi jutri.";
    }

    const products = await ctx.db.query("products").collect();
    const matchedItems: ReceiptItemMatch[] = [];
    let referenceTotal = 0;

    for (const item of args.parsed.items) {
      let bestMatch: { id: Id<"products">; score: number; name: string } | null = null;
      for (const product of products) {
        const score = scoreMatch(item.name, product.name);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { id: product._id, score, name: product.name };
        }
      }

      let referenceUnitPrice: number | undefined;
      if (bestMatch && bestMatch.score >= 0.3) {
        const prices = await ctx.db
          .query("prices")
          .withIndex("by_product", (q) => q.eq("productId", bestMatch!.id))
          .collect();
        if (prices.length > 0) {
          referenceUnitPrice = Math.max(
            ...prices.map((price) => price.originalPrice ?? price.price)
          );
        }
      }

      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      if (referenceUnitPrice) {
        referenceTotal += referenceUnitPrice * quantity;
      }

      matchedItems.push({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        matchedProductId: bestMatch && bestMatch.score >= 0.3 ? bestMatch.id : undefined,
        matchScore: bestMatch?.score,
        referenceUnitPrice,
      });
    }

    referenceTotal = Math.max(referenceTotal, totalPaid);
    const savedAmount = Math.max(0, referenceTotal - totalPaid);

    const seasonEligible = isWithinSeason(now) && !invalidReason;
    const seasonYear = seasonEligible ? getSeasonYear(now) : undefined;

    const receiptId = await ctx.db.insert("receipts", {
      userId,
      groupId,
      storeName,
      storeNameLower,
      purchaseDate: purchaseDateTimestamp,
      purchaseDateKey,
      purchaseTime: args.parsed.purchaseTime,
      totalPaid,
      currency: args.parsed.currency,
      referenceTotal,
      savedAmount: seasonEligible ? savedAmount : 0,
      isValid: !invalidReason,
      invalidReason,
      confirmed: args.confirmed,
      source: "camera",
      receiptFingerprint,
      seasonYear,
      seasonEligible,
      items: matchedItems,
    });

    if (!invalidReason) {
      const totalSavings = (profile.totalSavings || 0) + savedAmount;
      await ctx.db.patch(profile._id, {
        totalSavings,
      });

      if (seasonEligible && seasonYear) {
        const existingYear = await ctx.db
          .query("yearlySavings")
          .withIndex("by_user_year", (q) =>
            q.eq("userId", userId).eq("year", seasonYear)
          )
          .first();
        if (existingYear) {
          await ctx.db.patch(existingYear._id, {
            savings: existingYear.savings + savedAmount,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("yearlySavings", {
            userId,
            year: seasonYear,
            savings: savedAmount,
            updatedAt: now,
          });
        }
      }
    }

    if (!invalidReason) {
      const email = profile.email || "-";
      const nickname = profile.nickname || "-";
      const subject = "Nov potrjen račun v Pr'Hran";
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin: 0 0 12px;">Nov račun</h2>
          <p style="margin: 0 0 8px;"><strong>E-naslov:</strong> ${email}</p>
          <p style="margin: 0 0 8px;"><strong>Vzdevek:</strong> ${nickname}</p>
          <p style="margin: 0 0 8px;"><strong>Trgovina:</strong> ${storeName}</p>
          <p style="margin: 0 0 8px;"><strong>Datum:</strong> ${purchaseDateKey}</p>
          ${args.parsed.purchaseTime ? `<p style="margin: 0 0 8px;"><strong>Čas:</strong> ${args.parsed.purchaseTime}</p>` : ""}
          <p style="margin: 0 0 8px;"><strong>Znesek:</strong> ${totalPaid.toFixed(2)} EUR</p>
          <p style="margin: 0 0 8px;"><strong>Prihranek:</strong> ${savedAmount.toFixed(2)} EUR</p>
          <p style="margin: 16px 0 0; color: #475569; font-size: 12px;">Samodejno obvestilo iz Pr'Hran.</p>
        </div>
      `;
      await sendAdminNotification(subject, html);
    }

    return {
      success: true,
      receiptId,
      invalidReason,
      savedAmount: seasonEligible ? savedAmount : 0,
      storeName,
      totalPaid,
    };
  },
});

export const getReceipts = authQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("receipts"),
      _creationTime: v.number(),
      storeName: v.optional(v.string()),
      purchaseDate: v.number(),
      purchaseDateKey: v.string(),
      totalPaid: v.number(),
      savedAmount: v.number(),
      isValid: v.boolean(),
      invalidReason: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 50);

    return receipts.map((receipt) => ({
      _id: receipt._id,
      _creationTime: receipt._creationTime,
      storeName: receipt.storeName,
      purchaseDate: receipt.purchaseDate,
      purchaseDateKey: receipt.purchaseDateKey,
      totalPaid: receipt.totalPaid,
      savedAmount: receipt.savedAmount,
      isValid: receipt.isValid,
      invalidReason: receipt.invalidReason,
    }));
  },
});

// Alias for UI compatibility
export const getMyReceipts = getReceipts;
