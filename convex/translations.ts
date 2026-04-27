import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a translation
export const saveTranslation = mutation({
  args: {
    inputText: v.string(),
    translatedText: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("translations", args);
  },
});

// Get all past translations
export const getAllTranslations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("translations")
      .order("desc")
      .collect();
  },
});