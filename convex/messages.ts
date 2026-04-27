import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a message
export const saveMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.string(),
    originalText: v.string(),
    correctedText: v.optional(v.string()),
    language: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

// Get all messages for a session
export const getMessages = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});