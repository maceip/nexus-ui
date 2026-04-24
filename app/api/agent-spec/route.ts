import { NextResponse } from "next/server";

import { generateAgentSpec } from "@/lib/server/agent-spec/service";
import type { AgentSpecInput } from "@/lib/server/agent-spec/schema";

export async function POST(req: Request) {
  const body: AgentSpecInput = await req.json();

  const result = generateAgentSpec(body);

  return NextResponse.json(result);
}
