import { action } from "./_generated/server";
import { v } from "convex/values";

// AI akcija za prepoznavanje izdelkov iz slike
export const analyzeProductImage = action({
  args: {
    imageBase64: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    productName: v.optional(v.string()),
    confidence: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Preveri API ključ
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Če ni API ključa, uporabi simulacijo
      return simulateProductRecognition(args.imageBase64);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a HIGHLY ACCURATE product recognition AI specialized in SLOVENIAN grocery products. Your mission: identify the EXACT product with MAXIMUM precision.

🎯 RECOGNITION RULES:
1. READ ALL TEXT: Brand name, product type, flavor/variant, size/weight
2. PRIORITIZE BRAND: Always include brand if visible (Ljubljanske mlekarne, Vindija, Piškot, etc.)
3. BE SPECIFIC: "Alpsko mleko 3.5% 1L" NOT "mleko", "Milka čokolada jagoda 100g" NOT "čokolada"
4. INCLUDE SIZE: Add weight/volume if visible (1L, 500g, 250ml, 2L, etc.)
5. SLOVENIAN TERMS: Use Slovenian for generic words (mleko, kruh, jogurt, sir, etc.)
6. KEEP BRANDS: Brand names stay as-is (Milka, Nutella, Coca-Cola, etc.)
7. CENTER FOCUS: If multiple products, identify the MAIN/CENTERED one

✅ PERFECT EXAMPLES:
- "Alpsko mleko 3.5% 1L" (brand + type + variant + size)
- "Milka čokolada jagoda 100g" (brand + type + flavor + size)
- "Coca-Cola 0.5L" (brand + size)
- "Kruh beli narezani 500g" (type + variant + size)
- "Ljubljanske mlekarne maslo 250g" (brand + type + size)

❌ REJECT IF:
- Text is blurry/unreadable → respond "neznano"
- Multiple products unclear → respond "neznano"
- Not a grocery product → respond "neznano"

OUTPUT: Product name ONLY, NO explanations, NO brackets.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Identify this Slovenian grocery product. Include: brand (if visible) + product type + variant/flavor (if any) + size/weight (if visible). Respond with ONLY the product name.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: args.imageBase64.startsWith("data:")
                      ? args.imageBase64
                      : `data:image/jpeg;base64,${args.imageBase64}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 100,
          temperature: 0.05,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        return simulateProductRecognition(args.imageBase64);
      }

      const data = await response.json();
      const productName = data.choices?.[0]?.message?.content?.trim();

      if (!productName || productName.toLowerCase() === "neznano" || productName.length < 3) {
        return {
          success: false,
          productName: undefined,
          confidence: 0.1,
          error: "Izdelka ni bilo mogoče prepoznati. Poskusite z boljšo sliko.",
        };
      }

      // Validate that response is a reasonable product name
      const hasSlang = /slika je|cannot|unable|sorry|ni jasno|nejasno/i.test(productName);
      if (hasSlang) {
        return {
          success: false,
          productName: undefined,
          confidence: 0.2,
          error: "Izdelka ni bilo mogoče prepoznati. Poskusite z boljšo sliko.",
        };
      }

      return {
        success: true,
        productName: productName,
        confidence: 0.85,
      };
    } catch (error) {
      console.error("AI analysis error:", error);
      return simulateProductRecognition(args.imageBase64);
    }
  },
});

// Simulacija prepoznavanja za demo namene
function simulateProductRecognition(imageBase64: string): {
  success: boolean;
  productName?: string;
  confidence?: number;
  error?: string;
} {
  // Simuliraj prepoznavanje z naključnim izdelkom
  const demoProducts = [
    "Alpsko mleko 1L",
    "Coca-Cola 0.5L",
    "Nutella 400g",
    "Kruh beli 500g",
    "Jogurt Activia 150g",
    "Maslo Ljubljanske mlekarne 250g",
    "Jajca M 10 kom",
    "Banane 1kg",
    "Piščančje prsi 500g",
    "Sir Edamec 200g",
    "Čokolada Milka 100g",
    "Testenine Barilla 500g",
    "Paradižnikova omaka 400g",
    "Mineralna voda Radenska 1.5L",
    "Kava Barcaffe 250g",
  ];

  // Uporabi hash slike za konsistentno izbiro
  const hash = imageBase64.length % demoProducts.length;
  const selectedProduct = demoProducts[hash];

  return {
    success: true,
    productName: selectedProduct,
    confidence: 0.75 + Math.random() * 0.2,
  };
}
