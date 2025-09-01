import { NextRequest } from "next/server";
import vision from "@google-cloud/vision";
import { successServerAction } from "@repo/utils";
import OpenAI from "openai";
import { BoundingBox } from "@/types/editor";
import sharp from "sharp";
import Replicate from "replicate";
import { putImageToS3 } from "@/lib/utils/s3";

export const maxDuration = 120;
export type AnalyzeImageInput = {
  images: Array<{
    mimeType: string;
    dataBase64: string; // base64 without data URL prefix
    id: string;
    width: number;
    height: number;
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
  maskImage: string;
  inpaintedImage: string;
};
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const client = new vision.ImageAnnotatorClient({
  apiKey: process.env.GOOGLE_API_KEY,
});
const LEVEL = "paragraph";
const INVERT = false;
const PADDING = 4;

// 한자(CJK Ideographs) 포함 여부로 필터링
const cjkRegex = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeImageInput;
    const results: AnalyzeImageResult[] = [];
    for (const image of body.images) {
      const shapes: { type: string; poly: any; text: string }[] = [];
      const [result] = await client.textDetection({
        image: { content: image.dataBase64 },
      });

      const annotations = result.textAnnotations || [];
      const pages = result.fullTextAnnotation?.pages || [];
      for (const page of pages) {
        for (const block of page.blocks || []) {
          const poly = bboxToPolygon(block.boundingBox);
          if (poly) {
            shapes.push({ type: "poly", poly, text: "" });
          }
          for (const para of block.paragraphs || []) {
            if (LEVEL === "paragraph") {
              const poly = bboxToPolygon(para.boundingBox);
              const text = para.words?.map((w) => w.symbols?.map((s) => s.text || "").join("") || "").join("");
              if (poly) shapes.push({ type: "poly", poly, text: text || "" });
            }
          }
        }
      }
      const cjkShapes = shapes.filter((s) => cjkRegex.test(s.text));
      console.log({ cjkShapes });
      const bg = INVERT ? "#fff" : "#000";
      const fg = INVERT ? "#000" : "#fff";

      const svgParts = [];
      svgParts.push(
        `<svg width="${image.width}" height="${image.height}" viewBox="0 0 ${image.width} ${image.height}" xmlns="http://www.w3.org/2000/svg">`,
        `<rect x="0" y="0" width="${image.width}" height="${image.height}" fill="${bg}"/>`,
      );
      const textToTranslate: AnalyzedTextBox[] = [];
      for (const [idx, s] of cjkShapes.entries()) {
        if (PADDING > 0) {
          // Use expanded rect (bounding box) if padding is requested
          const { x, y, w, h } = polygonToRect(s.poly);
          const rx = clamp(x - PADDING, 0, image.width);
          const ry = clamp(y - PADDING, 0, image.height);
          const rw = clamp(w + PADDING * 2, 0, image.width - rx);
          const rh = clamp(h + PADDING * 2, 0, image.height - ry);
          textToTranslate.push({
            id: `${image.id}-${idx}`,
            original: s.text,
            bbox: {
              x: rx,
              y: ry,
              width: rw,
              height: rh,
            },
            translated: "",
            color: "#333333",
            fontSize: Math.round(rh * 0.8),
          });
          svgParts.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fg}"/>`);
        } else {
          // Draw the original quadrilateral
          const { x, y, w, h } = polygonToRect(s.poly);
          const points = s.poly
            .map((p: any) => `${clamp(p.x, 0, image.width)},${clamp(p.y, 0, image.height)}`)
            .join(" ");
          textToTranslate.push({
            id: `${image.id}-${idx}`,
            original: s.text,
            translated: "",
            bbox: {
              x: x,
              y: y,
              width: w,
              height: h,
            },
          });
          svgParts.push(`<polygon points="${points}" fill="${fg}"/>`);
        }
      }
      svgParts.push("</svg>");
      const svg = svgParts.join("\n");
      const buf = await sharp(Buffer.from(svg, "utf-8"))
        .resize(image.width, image.height, { fit: "fill" })
        .jpeg()
        .toBuffer();
      const baese64Data = buf.toString("base64");
      const maskImageData = `data:image/jpeg;base64,${baese64Data}`;
      const inpaintedImageData = await inpaintImage(
        { data: Buffer.from(image.dataBase64, "base64"), id: image.id },
        { data: buf, id: `${image.id}-mask` },
      );

      // annotations[0] 는 전체문장; 1번부터 개별 조각(워드/라인 유사)
      // const boxes = annotations
      //   .slice(1)
      //   .map((a) => ({
      //     text: a.description || "",
      //     vertices: a.boundingPoly?.vertices || [],
      //     // 간단한 box로 변환
      //     bbox: (() => {
      //       const xs = (a.boundingPoly?.vertices || []).map((v) => v.x || 0);
      //       const ys = (a.boundingPoly?.vertices || []).map((v) => v.y || 0);
      //       const x = Math.min(...xs),
      //         y = Math.min(...ys);
      //       const w = Math.max(...xs) - x,
      //         h = Math.max(...ys) - y;
      //       return { x, y, width: w, height: h };
      //     })(),
      //   }))
      //   .filter((b) => b.text.trim().length > 0 && b.bbox.width > 12 && b.bbox.height > 12);

      // boxes.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
      // const merged: { text: string; rect: { x: number; y: number; width: number; height: number } }[] = [];
      // const yTol = 8; // 픽셀 허용 오차
      // for (const b of boxes) {
      //   const last = merged[merged.length - 1];
      //   if (last && Math.abs(last.rect.y - b.bbox.y) < yTol) {
      //     // 같은 라인으로 판단 → 병합
      //     last.text += b.text;
      //     const x1 = Math.min(last.rect.x, b.bbox.x);
      //     const y1 = Math.min(last.rect.y, b.bbox.y);
      //     const x2 = Math.max(last.rect.x + last.rect.width, b.bbox.x + b.bbox.width);
      //     const y2 = Math.max(last.rect.y + last.rect.height, b.bbox.y + b.bbox.height);
      //     last.rect = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      //   } else {
      //     merged.push({ text: b.text, rect: b.bbox });
      //   }
      // }

      // const chineseOnly = merged.filter((m) => cjkRegex.test(m.text));

      // const textToTranslate = chineseOnly.map((m, idx) => {
      //   return {
      //     id: `${image.id}-${idx}`,
      //     original: m.text,
      //   };
      // });

      const promptText = [
        "You are an OCR + translation extractor.",
        "Provided text id and text :",
        textToTranslate.map((t) => `${t.id}: ${t.original}`).join("\n"),
        "Task:",
        "1) Detect ALL visible text in the provided image.",
        "2) This Image is about some selling product on website. Provide its **Korean translation** with the whole context of the text.",
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
        boxes: textToTranslate.map((m, idx) => {
          const id = `${image.id}-${idx}`;
          const target = parsed.boxes.find((b: any) => b.id === id);
          const color = target?.color;
          return {
            id,
            bbox: m.bbox,
            original: m.original,
            translated: target?.translated || m.original,
            color: color || m.color,
            fontSize: m.fontSize,
          };
        }),
        maskImage: maskImageData,
        inpaintedImage: inpaintedImageData,
      };

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
    console.error(e);
    return Response.json({ status: "error", message: e?.message || "analysis_failed", data: null }, { status: 500 });
  }
}

function bboxToPolygon(bbox: any) {
  if (!bbox?.vertices || bbox.vertices.length === 0) return null;
  // Vision vertices may be 4 points (possibly rotated). Some fields may be undefined.
  const verts = bbox.vertices.map((v: any) => ({
    x: v.x ?? 0,
    y: v.y ?? 0,
  }));
  // Ensure 4 points (Vision sometimes has normalizedVertices / or fewer; this defends lightly)
  while (verts.length < 4) verts.push({ x: 0, y: 0 });
  return verts.slice(0, 4);
}

function polygonToRect(poly: any) {
  const xs = poly.map((p: any) => p.x);
  const ys = poly.map((p: any) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export async function inpaintImage(image: { data: Buffer; id: string }, mask: { data: Buffer; id: string }) {
  const imageUrl = await putImageToS3(image.data, "image/jpeg", ["imageTest", image.id]);
  console.log({ imageUrl });
  const maskUrl = await putImageToS3(mask.data, "image/jpeg", ["imageTest", mask.id]);
  console.log({ maskUrl });
  const replicate = new Replicate();
  const output = (await replicate.run(
    "zylim0702/remove-object:0e3a841c913f597c1e4c321560aa69e2bc1f15c65f8c366caafc379240efd8ba",
    {
      input: {
        image: imageUrl,
        mask: maskUrl,
      },
    },
  )) as any;
  const url = output.url();
  return url.href;
}
