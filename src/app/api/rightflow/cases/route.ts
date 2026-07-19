import { NextResponse } from "next/server";
import { buildRightFlowCase, normalizeNarrative } from "@/lib/rightflow";
import { extractFactsWithQwen } from "@/lib/qwen-rightflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { narrative?: unknown };
    const narrative = normalizeNarrative(body.narrative);
    const qwen = await extractFactsWithQwen(narrative);
    return NextResponse.json(buildRightFlowCase(narrative, qwen ? { qwenFacts: qwen.facts, model: qwen.model } : {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
