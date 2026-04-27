import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { transcript, topic, durationSeconds } = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ error: "Speech too short to evaluate." }, { status: 400 });
    }

    const prompt = `You are an expert English speaking coach. A student just gave a speech on the topic: "${topic}".
They spoke for ${Math.round(durationSeconds / 60)} minutes and ${durationSeconds % 60} seconds.

Here is their full speech transcript:
"""
${transcript}
"""

Your job is to evaluate this speech and return ONLY a valid JSON object. No explanation before or after. No markdown. Just raw JSON.

Return exactly this structure:
{
  "scores": {
    "fluency": <number 0-10>,
    "grammar": <number 0-10>,
    "vocabulary": <number 0-10>,
    "total": <number 0-30>
  },
  "improvements": [
    {
      "original": "<exact sentence or phrase from transcript that needs work>",
      "improved": "<the corrected version>",
      "reason": "<one short sentence explaining why>"
    }
  ],
  "correctedSpeech": "<the full speech rewritten correctly, naturally, keeping the student's meaning and style but fixing all errors>",
  "summary": "<2-3 sentences of warm encouraging feedback mentioning their strongest point and main area to work on>"
}

SCORING GUIDE:
- Fluency (0-10): How naturally they spoke. Penalize repetition, filler words (um, uh, like), incomplete sentences.
- Grammar (0-10): Correct tense, subject-verb agreement, articles, prepositions.
- Vocabulary (0-10): Word variety, appropriate word choice, avoiding repetition of simple words.
- Total: exact sum of the three scores.

IMPROVEMENTS RULES:
- Include EVERY sentence or phrase that has a grammar, vocabulary, or fluency issue.
- If a sentence is perfect, do NOT include it.
- Keep "original" as close to the transcript as possible.
- Keep "improved" natural — don't make it sound too formal.
- Keep "reason" short — max 10 words.

IMPORTANT: Return ONLY the JSON. No text before or after.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // Clean up any accidental markdown fences
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", cleaned);
      return NextResponse.json({ error: "AI response was not valid JSON. Please try again." }, { status: 500 });
    }

    // Validate scores add up correctly
    const { fluency, grammar, vocabulary } = parsed.scores;
    parsed.scores.total = fluency + grammar + vocabulary;

    return NextResponse.json(parsed);

  } catch (error) {
    console.error("Speech coach error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}