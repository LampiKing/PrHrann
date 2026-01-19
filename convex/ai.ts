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
              content: `Ti si AI za prepoznavanje SLOVENSKIH živilskih izdelkov. NATANČNO preberi VSE besedilo na embalaži.

PRAVILA:
1. PREBERI TOČNO kar piše na izdelku - NE ugibaj
2. Blagovna znamka VEDNO prva (Jaffa, Milka, Argeta, Alpsko, itd.)
3. Tip izdelka (keksi, čokolada, mleko, pašteta, itd.)
4. Velikost če je vidna (100g, 1L, 500ml, itd.)

PRIMERI pravilnih odgovorov:
- "Jaffa keksi 150g" (NE "čokoladni piškoti")
- "Milka čokolada 100g" (NE samo "čokolada")
- "Argeta pašteta 95g" (NE "jetrna pašteta")
- "Alpsko mleko 1L" (NE samo "mleko")
- "Cockta 0.5L" (NE "gazirani sok")

KRITIČNO:
- Jaffa = keksi z marmelado in čokolado (slovenska znamka)
- Argeta = paštete
- Cockta = slovenski gazirani napitek
- Če ne moreš prebrati besedila → odgovori "neznano"

ODGOVORI SAMO z imenom izdelka, BREZ razlag.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Preberi besedilo na tem izdelku in mi povej KAJ TOČNO je to. Samo ime izdelka, nič drugega.",
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

// Ko AI ni nastavljen - povej uporabniku
function simulateProductRecognition(_imageBase64: string): {
  success: boolean;
  productName?: string;
  confidence?: number;
  error?: string;
} {
  // NE daj naključnih rezultatov - povej uporabniku da AI ni na voljo
  return {
    success: false,
    productName: undefined,
    confidence: 0,
    error: "Prepoznava slik trenutno ni na voljo. Vpiši ime izdelka ročno.",
  };
}
