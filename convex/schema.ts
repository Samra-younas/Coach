import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    sessionName: v.string(),
    createdAt: v.number(),
  }),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.string(),
    originalText: v.string(),
    correctedText: v.optional(v.string()),
    language: v.string(),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  translations: defineTable({
    inputText: v.string(),
    translatedText: v.string(),
    timestamp: v.number(),
  }),

  // ── NEW: Daily Speech Practice ──
  speechSessions: defineTable({
    topic: v.string(),             // the daily topic given to user
    transcript: v.string(),        // full speech text (from Web Speech API)
    correctedSpeech: v.string(),   // full corrected version of the speech
    improvements: v.array(v.object({
      original: v.string(),        // what user said
      improved: v.string(),        // what they should say
      reason: v.string(),          // why it needs improvement
    })),
    scores: v.object({
      fluency: v.number(),         // 0-10
      grammar: v.number(),         // 0-10
      vocabulary: v.number(),      // 0-10
      total: v.number(),           // 0-30
    }),
    durationSeconds: v.number(),   // how long they spoke
    date: v.string(),              // "2026-04-27" for streak tracking
    timestamp: v.number(),
  }).index("by_date", ["date"]),
});