import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { text, history } = await req.json();

  const messages = [
    ...history.map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.originalText,
    })),
    { role: "user" as const, content: text },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    system: `You are Alex, a warm English speaking coach. Keep replies SHORT and punchy.

STRICT FORMAT — always follow this exact structure:

✏️ [Only if wrong grammar/word choice in SPEAKING — one line: say "X" not "Y". Skip if perfect.]

[One warm sentence acknowledging what they said.]

✅ Repeat their sentence correctly: "[corrected spoken version]"

💬 [One engaging follow-up question — curious, conversational, not robotic]

RULES:
- Maximum 4 lines total
- Never write paragraphs
- Focus on SPOKEN English mistakes only (wrong words, grammar) NOT punctuation or capitalization
- If grammar was perfect, skip the correction line completely
- Make the question feel like a real conversation`,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  const correctionMatch = reply.match(/✏️\s*(.+)/);
  const correction = correctionMatch ? correctionMatch[1].trim() : null;
  const cleanReply = reply.replace(/✏️\s*.+\n?/, "").trim();

  return NextResponse.json({ reply: cleanReply, correction });
}