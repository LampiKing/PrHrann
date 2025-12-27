import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * AI PARSER ZA SPAR KUPONE
 * 
 * Uporaba:
 * 1. Uploadas sliko od SPAR kupona (URL ali base64)
 * 2. GPT Vision prebere sliko
 * 3. Vrne strukturirane podatke o kuponih
 * 4. Avtomatsko kreira kupone v bazi
 */

interface ParsedCoupon {
  description: string;
  discountType: "percentage_total" | "percentage_single_item" | "fixed" | "category_discount";
  discountValue: number;
  minPurchase?: number;
  validDays: number[]; // 0=Nedelja, 1=Ponedeljek, ..., 6=Sobota
  validDates?: {
    from: string; // ISO date string
    until: string;
  };
  requiresLoyaltyCard: boolean;
  maxUsesPerUser?: number;
  excludedProducts: string[];
  additionalNotes: string;
  excludeSaleItems: boolean;
  canCombine: boolean;
}

export const parseSparCouponImage = action({
  args: {
    imageUrl: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; coupons?: ParsedCoupon[]; error?: string }> => {
    // Preveri API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "OPENAI_API_KEY ni nastavljen. Nastavi z: bunx convex env set OPENAI_API_KEY sk-...",
      };
    }

    if (!args.imageUrl && !args.imageBase64) {
      return {
        success: false,
        error: "Potreben je imageUrl ali imageBase64",
      };
    }

    // Basic input validation & limits
    if (args.imageUrl) {
      try {
        const u = new URL(args.imageUrl);
        if (!["http:", "https:"].includes(u.protocol)) {
          return { success: false, error: "Neveljaven URL protokol" };
        }
      } catch {
        return { success: false, error: "Neveljaven imageUrl" };
      }
    }

    if (args.imageBase64) {
      // Limit base64 size to ~1.5MB to prevent abuse
      const approxBytes = args.imageBase64.length * 0.75;
      if (approxBytes > 1_500_000) {
        return { success: false, error: "Slika je prevelika (max ~1.5MB)" };
      }
    }

    try {
      const imageContent = args.imageUrl
        ? { type: "image_url" as const, image_url: { url: args.imageUrl } }
        : { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${args.imageBase64}` } };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o", // GPT-4 Turbo with vision
          messages: [
            {
              role: "system",
              content: `Ti si ekspert za analizo slovenskih SPAR kuponov. Tvoja naloga je ekstraktirati VSE podatke iz slike kupona.

POMEMBNO - Dnevi v tednu:
- Ponedeljek = 1
- Torek = 2  
- Sreda = 3
- Četrtek = 4
- Petek = 5
- Sobota = 6
- Nedelja = 0

POMEMBNO - Tipi popustov:
- "percentage_total" = % popust na CELOTEN nakup (npr. "10% na celoten nakup")
- "percentage_single_item" = % popust na EN IZDELEK (npr. "25% na en izdelek")
- "fixed" = Fiksna vrednost (npr. "5€ popusta")
- "category_discount" = Popust na kategorijo izdelkov

Vrni JSON array z vsemi kuponi na sliki. Vsak kupon mora imeti:
{
  "description": "Kratek opis (npr. '10% popust na celoten nakup')",
  "discountType": "percentage_total" ali "percentage_single_item" ali "fixed" ali "category_discount",
  "discountValue": število (npr. 10 za 10%, ali 5 za 5€),
  "minPurchase": minimalen nakup v € (ali undefined),
  "validDays": [seznam številk dni, npr. [1,2,3] za Pon-Sre],
  "validDates": {
    "from": "YYYY-MM-DD",
    "until": "YYYY-MM-DD"
  } (ali undefined če ni specifičnih datumov),
  "requiresLoyaltyCard": true (če potrebuje SPAR plus/EYCA),
  "maxUsesPerUser": 1 (za enkratno uporabo) ali undefined (neomejeno),
  "excludedProducts": ["seznam izključenih izdelkov"],
  "additionalNotes": "vsi dodatni pogoji",
  "excludeSaleItems": false (običajno velja tudi za akcije),
  "canCombine": false (običajno se popusti ne seštevajo)
}

NATANČNO preberi:
- Katere DNEVE velja (npr. "ponedeljek, torek, sreda" = [1,2,3])
- Ali velja na CELOTEN nakup ali EN IZDELEK
- Vse IZKLJUČITVE (tobak, časopisi, kartice, itd.)
- Če piše "SAMO SOBOTA 27.12.2025" ali podobno, dodaj tudi validDates
- Če piše "ob nakupu nad 30€", dodaj minPurchase: 30

Vrni SAMO JSON, brez dodatnega besedila.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analiziraj ta SPAR kupon in ekstrahiraj vse podatke. Bodi ZELO natančen pri dnevih, tipu popusta in izključitvah.",
                },
                imageContent,
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.1, // Nizka temperatura za večjo natančnost
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        return {
          success: false,
          error: `OpenAI API napaka: ${response.status} - ${errorData}`,
        };
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: "GPT Vision ni vrnil odgovora",
        };
      }

      // Parse JSON odgovor
      let parsedCoupons: ParsedCoupon[];
      try {
        // Odstrani morebitne markdown code blocke
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsedCoupons = JSON.parse(cleanContent);
      } catch {
        return {
          success: false,
          error: `Napaka pri parsanju JSON: ${content}`,
        };
      }

      // Validiraj strukture
      if (!Array.isArray(parsedCoupons)) {
        parsedCoupons = [parsedCoupons];
      }

      return {
        success: true,
        coupons: parsedCoupons,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Napaka: ${error.message}`,
      };
    }
  },
});
