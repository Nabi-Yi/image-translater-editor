import { NextRequest } from "next/server";
import { analyzeImagesAction } from "@/lib/gemini";
export const maxDuration = 120;
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await analyzeImagesAction(body);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ status: "error", message: e?.message || "analysis_failed", data: null }, { status: 500 });
  }
}
