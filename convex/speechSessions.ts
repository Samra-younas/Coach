import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a completed speech session
export const saveSpeechSession = mutation({
  args: {
    topic: v.string(),
    transcript: v.string(),
    correctedSpeech: v.string(),
    improvements: v.array(v.object({
      original: v.string(),
      improved: v.string(),
      reason: v.string(),
    })),
    scores: v.object({
      fluency: v.number(),
      grammar: v.number(),
      vocabulary: v.number(),
      total: v.number(),
    }),
    durationSeconds: v.number(),
    date: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("speechSessions", args);
  },
});

// Get all speech sessions (for history page), newest first
export const getAllSpeechSessions = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("speechSessions")
      .order("desc")
      .collect();
  },
});

// Get a single speech session by ID (for detail view)
export const getSpeechSession = query({
  args: { id: v.id("speechSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get sessions for a specific date (for streak checking)
export const getSpeechSessionsByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("speechSessions")
      .withIndex("by_date", q => q.eq("date", args.date))
      .collect();
  },
});

// Get streak count — how many consecutive days user has practiced
export const getStreak = query({
  handler: async (ctx) => {
    const all = await ctx.db
      .query("speechSessions")
      .order("desc")
      .collect();

    if (all.length === 0) return 0;

    // Get unique dates, sorted descending
    const uniqueDates = [...new Set(all.map(s => s.date))].sort().reverse();

    let streak = 0;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Streak only counts if user practiced today or yesterday
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

    let checkDate = uniqueDates[0] === today ? today : yesterday;

    for (const date of uniqueDates) {
      if (date === checkDate) {
        streak++;
        // Go back one day
        const d = new Date(checkDate);
        d.setDate(d.getDate() - 1);
        checkDate = d.toISOString().split("T")[0];
      } else {
        break;
      }
    }

    return streak;
  },
});

// Get best score ever
export const getBestScore = query({
  handler: async (ctx) => {
    const all = await ctx.db
      .query("speechSessions")
      .collect();
    if (all.length === 0) return 0;
    return Math.max(...all.map(s => s.scores.total));
  },
});