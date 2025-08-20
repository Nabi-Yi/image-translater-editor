import { NextRequest } from "next/server";
import vision from "@google-cloud/vision";
import { successServerAction } from "@repo/utils";
import OpenAI from "openai";
import { BoundingBox } from "@/types/editor";

export const maxDuration = 120;
export type AnalyzeImageInput = {
  images: Array<{
    mimeType: string;
    dataBase64: string; // base64 without data URL prefix
    id: string;
  }>;
};
export type AnalyzedTextBox = {
  id: string;
  bbox: BoundingBox;
  original: string;
  translated: string;
  fontSize?: number;
  color?: string;
};

export type AnalyzeImageResult = {
  imageId: string;
  width?: number;
  height?: number;
  boxes: AnalyzedTextBox[];
};
const API_KEY = process.env.GOOGLE_API_KEY;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const client = new vision.ImageAnnotatorClient({
  apiKey: process.env.GOOGLE_API_KEY,
});
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeImageInput;
    const results: AnalyzeImageResult[] = [];
    for (const image of body.images) {
      const [result] = await client.textDetection({
        image: { content: image.dataBase64 },
      });

      const annotations = result.textAnnotations || [];
      // annotations[0] 는 전체문장; 1번부터 개별 조각(워드/라인 유사)
      const boxes = annotations
        .slice(1)
        .map((a) => ({
          text: a.description || "",
          vertices: a.boundingPoly?.vertices || [],
          // 간단한 box로 변환
          bbox: (() => {
            const xs = (a.boundingPoly?.vertices || []).map((v) => v.x || 0);
            const ys = (a.boundingPoly?.vertices || []).map((v) => v.y || 0);
            const x = Math.min(...xs),
              y = Math.min(...ys);
            const w = Math.max(...xs) - x,
              h = Math.max(...ys) - y;
            return { x, y, width: w, height: h };
          })(),
        }))
        .filter((b) => b.text.trim().length > 0 && b.bbox.width > 12 && b.bbox.height > 12);

      boxes.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
      const merged: { text: string; rect: { x: number; y: number; width: number; height: number } }[] = [];
      const yTol = 8; // 픽셀 허용 오차
      for (const b of boxes) {
        const last = merged[merged.length - 1];
        if (last && Math.abs(last.rect.y - b.bbox.y) < yTol) {
          // 같은 라인으로 판단 → 병합
          last.text += b.text;
          const x1 = Math.min(last.rect.x, b.bbox.x);
          const y1 = Math.min(last.rect.y, b.bbox.y);
          const x2 = Math.max(last.rect.x + last.rect.width, b.bbox.x + b.bbox.width);
          const y2 = Math.max(last.rect.y + last.rect.height, b.bbox.y + b.bbox.height);
          last.rect = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        } else {
          merged.push({ text: b.text, rect: b.bbox });
        }
      }

      const textToTranslate = merged.map((m, idx) => {
        return {
          id: `${image.id}-${idx}`,
          original: m.text,
        };
      });

      const promptText = [
        "You are an OCR + translation extractor.",
        "Provided text id and text :",
        textToTranslate.map((t) => `${t.id}: ${t.original}`).join("\n"),
        "Task:",
        "1) Detect ALL visible text in the provided image.",
        "2) Provide its **Korean translation**",
        "3) For each detected text box, ESTIMATE the color of the text in hex format (e.g., #000000). If uncertain, provide your best estimate",
        "4) match with the provided text id and return the translated text and color",
        "6) Return STRICT JSON with this schema (no extra text):",
        '{"boxes":[{"id":"string","translated":"string","color":string}]}',
      ].join("\n");
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        response_format: { type: "json_object" },
        reasoning_effort: "minimal",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.dataBase64}` } },
            ],
          },
        ],
      });
      const text = completion.choices?.[0]?.message?.content || "{}";
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          console.error(e);
          throw new Error("Failed to parse model response");
        }
      }

      const result2: AnalyzeImageResult = {
        imageId: image.id,
        width: result.fullTextAnnotation?.pages?.[0]?.width || undefined,
        height: result.fullTextAnnotation?.pages?.[0]?.height || undefined,
        boxes: merged.map((m, idx) => {
          const id = `${image.id}-${idx}`;
          const target = parsed.boxes.find((b: any) => b.id === id);
          const color = target?.color;
          return {
            id,
            bbox: m.rect,
            original: m.text,
            translated: target?.translated || m.text,
            color: color || "#333333",
            fontSize: Math.round(m.rect.height * 0.8),
          };
        }),
      };

      console.log(result2);
      results.push(result2);

      // const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     requests: [
      //       {
      //         image: { content: body.images[0].dataBase64 }, // 또는 { content: base64 }
      //         features: [{ type: "TEXT_DETECTION" }],
      //       },
      //     ],
      //   }),
      // });
      // const result = await response.json();
      // console.log(JSON.stringify(result, null, 2));
      // const [result] = await client.textDetection(body.images.map((image) => ({ content: image.dataBase64 })));
      // console.log(result);
      // return Response.json(result);
    }
    return Response.json(successServerAction("analyzed", { results }));
  } catch (e: any) {
    return Response.json({ status: "error", message: e?.message || "analysis_failed", data: null }, { status: 500 });
  }
}
