import { NextResponse } from "next/server";
import { approveAndScreenRightFlowCase } from "@/lib/rightflow";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { caseId?: unknown; facts?: unknown };
    return NextResponse.json(approveAndScreenRightFlowCase(body.caseId, body.facts));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid approval request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
