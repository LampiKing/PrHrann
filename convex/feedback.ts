import { v } from "convex/values";
import { action } from "./_generated/server";

// Feedback categories
export const FEEDBACK_CATEGORIES = [
  { id: "bug", label: "Napaka / Bug", icon: "bug" },
  { id: "feature", label: "Nova funkcija", icon: "bulb" },
  { id: "improvement", label: "Izboljšava", icon: "trending-up" },
  { id: "design", label: "Dizajn / Izgled", icon: "color-palette" },
  { id: "other", label: "Drugo", icon: "chatbubble" },
] as const;

export const sendFeedback = action({
  args: {
    category: v.string(),
    message: v.string(),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    const feedbackEmail = process.env.FEEDBACK_EMAIL || "prrhran@gmail.com";
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const categoryLabel = FEEDBACK_CATEGORIES.find(c => c.id === args.category)?.label || args.category;
    
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1025 0%, #0a0a0f 100%); border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">📬 Nov feedback</h1>
        </div>
        
        <div style="padding: 24px;">
          <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Kategorija</p>
            <p style="margin: 0; color: #a855f7; font-size: 18px; font-weight: 600;">${categoryLabel}</p>
          </div>
          
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Sporočilo</p>
            <p style="margin: 0; color: #f1f5f9; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${args.message}</p>
          </div>
          
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">
              <strong style="color: #9ca3af;">Od:</strong> ${args.userName || "Neznan uporabnik"}
            </p>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              <strong style="color: #9ca3af;">Email:</strong> ${args.userEmail || "Ni na voljo"}
            </p>
          </div>
        </div>
        
        <div style="background: rgba(0,0,0,0.3); padding: 16px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Poslano iz Pr'Hran aplikacije • ${new Date().toLocaleDateString("sl-SI")} ob ${new Date().toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    `;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Pr'Hran Feedback <noreply@prhran.com>",
          to: feedbackEmail,
          subject: `[${categoryLabel}] Nov feedback od ${args.userName || "uporabnika"}`,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Feedback email failed: ${response.status} ${errorText}`);
        return { success: false, error: "Napaka pri pošiljanju" };
      }

      console.log(`Feedback sent successfully from: ${args.userEmail || "unknown"}`);
      return { success: true };
    } catch (error) {
      console.error("Feedback send error:", error);
      return { success: false, error: "Napaka pri pošiljanju" };
    }
  },
});
