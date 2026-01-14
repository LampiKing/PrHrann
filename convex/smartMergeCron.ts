import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Cron job za avtomatsko AI združevanje izdelkov
 * Poganja se vsake 6 ur in združi izdelke iz različnih trgovin
 */
export const runAutoMerge = internalAction({
  args: {},
  returns: v.object({
    batches: v.number(),
    totalMerged: v.number(),
  }),
  handler: async (ctx) => {
    let totalMerged = 0;
    let batches = 0;
    const maxBatches = 20; // Max 20 batchev per cron run

    for (let i = 0; i < maxBatches; i++) {
      try {
        const result = await ctx.runAction(api.smartMerge.runSmartMerge, {
          batchSize: 50,
          useAI: true,
        });

        batches++;
        const merged = result.mergedByAI + result.mergedByImage;
        totalMerged += merged;

        // Če ni več kaj združiti, končaj
        if (result.processed === 0 || result.noApiKey) {
          break;
        }

        // Če ni bilo nobenega matcha v zadnjih 3 batchih, končaj
        if (merged === 0 && i >= 3) {
          break;
        }
      } catch (error) {
        console.error("Auto merge batch error:", error);
        break;
      }
    }

    console.log(`Auto merge completed: ${totalMerged} merged in ${batches} batches`);
    return { batches, totalMerged };
  },
});
