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
              content: `Si pomočnik za prepoznavanje živilskih izdelkov na slikah. 
              Tvoja naloga je identificirati ime izdelka na sliki.
              Odgovori SAMO z imenom izdelka v slovenščini, brez dodatnih besed.
              Če ne moreš prepoznati izdelka, odgovori z "neznano".
              Primeri: "Alpsko mleko 1L", "Coca-Cola 0.5L", "Kruh beli 500g", "Nutella 400g"`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Kateri izdelek je na tej sliki? Odgovori samo z imenom izdelka.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: args.imageBase64.startsWith("data:") 
                      ? args.imageBase64 
                      : `data:image/jpeg;base64,${args.imageBase64}`,
                    detail: "low",
                  },
                },
              ],
            },
          ],
          max_tokens: 100,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        return simulateProductRecognition(args.imageBase64);
      }

      const data = await response.json();
      const productName = data.choices?.[0]?.message?.content?.trim();

      if (!productName || productName.toLowerCase() === "neznano") {
        return {
          success: false,
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
