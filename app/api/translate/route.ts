import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    system: `You are a translator. The user will give you Urdu text (a word or sentence).
Translate it to English clearly and naturally.
Also give a simple example sentence using the translation.

Respond in this JSON format only:
{
  "translation": "English translation here",
  "example": "Example sentence using this word/phrase"
}`,
    messages: [{ role: "user", content: text }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ translation: `${parsed.translation} — e.g. "${parsed.example}"` });
  } catch {
    return NextResponse.json({ translation: raw });
  }
}