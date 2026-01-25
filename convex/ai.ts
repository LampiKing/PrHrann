import { action } from "./_generated/server";
import { v } from "convex/values";

const PRODUCT_SYSTEM_PROMPT = `Ti si AI za prepoznavanje SLOVENSKIH živilskih izdelkov. NATANČNO preberi VSE besedilo na embalaži.

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

ODGOVORI SAMO z imenom izdelka, BREZ razlag.`;

const PRODUCT_USER_PROMPT = "Preberi besedilo na tem izdelku in mi povej KAJ TOČNO je to. Samo ime izdelka, nič drugega.";

// Najprej poskusi Groq (brezplačno), potem OpenAI
async function analyzeWithGroq(imageBase64: string): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          { role: "system", content: PRODUCT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: PRODUCT_USER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.05,
      }),
    });

    if (!response.ok) {
      console.log("Groq product scan error:", response.status);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.log("Groq product scan exception:", error);
    return null;
  }
}

async function analyzeWithOpenAI(imageBase64: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

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
          { role: "system", content: PRODUCT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: PRODUCT_USER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.05,
      }),
    });

    if (!response.ok) {
      console.log("OpenAI product scan error:", response.status);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.log("OpenAI product scan exception:", error);
    return null;
  }
}

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
    // Poskusi Groq najprej (brezplačno), potem OpenAI
    let productName = await analyzeWithGroq(args.imageBase64);

    if (!productName) {
      productName = await analyzeWithOpenAI(args.imageBase64);
    }

    if (!productName) {
      return simulateProductRecognition(args.imageBase64);
    }

    // Preveri če je veljaven rezultat
    if (productName.toLowerCase() === "neznano" || productName.length < 3) {
      return {
        success: false,
        productName: undefined,
        confidence: 0.1,
        error: "Izdelka ni bilo mogoče prepoznati. Poskusite z boljšo sliko.",
      };
    }

    // Preveri če odgovor vsebuje napake/zavrnitve
    const hasError = /slika je|cannot|unable|sorry|ni jasno|nejasno|i cannot|i can't/i.test(productName);
    if (hasError) {
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
