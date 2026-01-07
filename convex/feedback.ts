import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authMutation } from "./functions";

// Feedback categories
export const FEEDBACK_CATEGORIES = [
  { id: "bug", label: "Napaka / Bug", icon: "bug" },
  { id: "feature", label: "Nova funkcija", icon: "bulb" },
  { id: "improvement", label: "Izboljšava", icon: "trending-up" },
  { id: "design", label: "Dizajn / Izgled", icon: "color-palette" },
  { id: "other", label: "Drugo", icon: "chatbubble" },
] as const;

const FEEDBACK_TO_SUGGESTION: Record<string, "feature" | "improvement" | "bug" | "other"> = {
  bug: "bug",
  feature: "feature",
  improvement: "improvement",
  design: "improvement",
  other: "other",
};

const getCategoryLabel = (category: string) =>
  FEEDBACK_CATEGORIES.find((c) => c.id === category)?.label || category;

const buildSuggestionTitle = (message: string, categoryLabel: string) => {
  const firstLine = message.split(/\r?\n/)[0].trim();
  if (firstLine.length >= 5) {
    return firstLine.slice(0, 80);
  }
  return `${categoryLabel} predlog`;
};

export const storeFeedbackInternal = internalMutation({
  args: {
    userId: v.string(),
    userName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    category: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedMessage = args.message.trim();
    if (!trimmedMessage) {
      throw new Error("Feedback message is empty");
    }

    const categoryLabel = getCategoryLabel(args.category);
    const suggestionType = FEEDBACK_TO_SUGGESTION[args.category] || "other";
    const title = buildSuggestionTitle(trimmedMessage, categoryLabel);
    const description = args.userEmail
      ? `${trimmedMessage}\n\nKontakt: ${args.userEmail}`
      : trimmedMessage;

    await ctx.db.insert("userSuggestions", {
      userId: args.userId,
      userNickname: args.userName || "Anonimen",
      suggestionType,
      title,
      description,
      status: "pending",
      rewardGiven: false,
      submittedAt: Date.now(),
    });
  },
});

export const submitFeedback = authMutation({
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
    const trimmedMessage = args.message.trim();
    if (!trimmedMessage) {
      return { success: false, error: "Sporočilo je prazno." };
    }

    const categoryLabel = getCategoryLabel(args.category);
    const suggestionType = FEEDBACK_TO_SUGGESTION[args.category] || "other";
    const title = buildSuggestionTitle(trimmedMessage, categoryLabel);
    const description = args.userEmail
      ? `${trimmedMessage}\n\nKontakt: ${args.userEmail}`
      : trimmedMessage;
    
    // Get user info safely
    const user = ctx.user as { _id: string; name?: string } | undefined;
    if (!user || !user._id) {
      return { success: false, error: "Uporabnik ni prijavljen." };
    }
    
    const userName = args.userName || user.name || "Anonimen";
    const userId = typeof user._id === "string" ? user._id : String(user._id);

    try {
      await ctx.db.insert("userSuggestions", {
        userId,
        userNickname: userName,
        suggestionType,
        title,
        description,
        status: "pending",
        rewardGiven: false,
        submittedAt: Date.now(),
      });
    } catch (error) {
      console.error("Feedback store error:", error);
      return { success: false, error: "Feedback ni bilo mogoče shraniti." };
    }

    return { success: true };
  },
});

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
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject || "anonymous";

    try {
      await ctx.runMutation(internal.feedback.storeFeedbackInternal, {
        userId,
        userName: args.userName || identity?.name || undefined,
        userEmail: args.userEmail || identity?.email || undefined,
        category: args.category,
        message: args.message,
      });
    } catch (error) {
      console.error("Feedback store error:", error);
      return { success: false, error: "Feedback ni bilo mogoče shraniti." };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const feedbackEmail = process.env.FEEDBACK_EMAIL || "prrhran@gmail.com";
    
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured - stored feedback only");
      return { success: true };
    }

    const categoryLabel = getCategoryLabel(args.category);
    
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
      const fromEmail = process.env.FROM_EMAIL || "noreply@prhran.com";
      const fromName = process.env.FROM_NAME || "Pr'Hran Feedback";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: feedbackEmail,
          subject: `[${categoryLabel}] Nov feedback od ${args.userName || "uporabnika"}`,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Feedback email failed: ${response.status} ${errorText}`);
        return { success: true };
      }

      console.log(`Feedback sent successfully from: ${args.userEmail || "unknown"}`);
      return { success: true };
    } catch (error) {
      console.error("Feedback send error:", error);
      return { success: true };
    }
  },
});
