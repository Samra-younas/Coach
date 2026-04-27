import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: { sessionName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      sessionName: args.sessionName,
      createdAt: Date.now(),
    });
  },
});

export const getAllSessions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sessions").order("desc").collect();
  },
});

export const renameSession = mutation({
  args: { sessionId: v.id("sessions"), sessionName: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { sessionName: args.sessionName });
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.sessionId);
  },
});