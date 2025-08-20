"use server";

import { GoogleGenAI } from "@google/genai";
import { successServerAction, throwServerAction } from "@repo/utils";
import OpenAI from "openai";

export type AnalyzeImageInput = {
  images: Array<{
    mimeType: string;
    dataBase64: string; // base64 without data URL prefix
    id: string;
  }>;
  model?: string;
};

export type BoundingBox = { x: number; y: number; width: number; height: number };

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

async function analyzeImagesWithGPT(input: AnalyzeImageInput, model: string): Promise<AnalyzeImageResult[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

  const promptText = [
    "You are an OCR + translation extractor.",
    "Task:",
    "1) Detect ALL visible text regions with TIGHT bounding boxes in the provided image.",
    "2) Each bbox uses absolute pixel coordinates relative to the original image: x,y,width,height (integers).",
    "3) Ensure bboxes are fully within image bounds and tightly wrap the text (no excessive padding).",
    "4) Provide the original text and its **Korean translation**.",
    "5) For each detected text box, ESTIMATE the font size in pixels (integer) relative to the original image. If uncertain, provide your best estimate.",
    "6) For each detected text box, ESTIMATE the color of the text in hex format (e.g., #000000). If uncertain, provide your best estimate",
    "7) Return STRICT JSON with this schema (no extra text):",
    '{"boxes":[{"id":"string","bbox":{"x":number,"y":number,"width":number,"height":number},"original":"string","translated":"string","fontSize":number,"color":string}]}',
  ].join("\n");

  const results: AnalyzeImageResult[] = [];

  for (const img of input.images) {
    const dataUrl = `data:${img.mimeType};base64,${img.dataBase64}`;

    const completion = await openai.chat.completions.create({
      model,

      response_format: { type: "json_object" },
      reasoning_effort: "minimal",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: dataUrl } },
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

    const boxes: AnalyzedTextBox[] = Array.isArray(parsed?.boxes)
      ? parsed.boxes
          .filter((b: any) => b && b.bbox && typeof b.original === "string")
          .map((b: any, idx: number) => ({
            id: b.id || `${img.id}-${idx}`,
            bbox: {
              x: Number(b.bbox.x) || 0,
              y: Number(b.bbox.y) || 0,
              width: Number(b.bbox.width) || 0,
              height: Number(b.bbox.height) || 0,
            },
            color: b.color || "#333333",
            original: String(b.original || ""),
            translated: String(b.translated || ""),
            fontSize: Number.isFinite(Number(b.fontSize)) ? Math.round(Number(b.fontSize)) : undefined,
          }))
      : [];

    results.push({ imageId: img.id, boxes });
  }

  return results;
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

async function analyzeImagesWithGemini(input: AnalyzeImageInput, model: string): Promise<AnalyzeImageResult[]> {
  const prompts = input.images.map((img) => ({
    role: "user" as const,

    text: [
      "You are an OCR + translation extractor.",
      "Task:",
      "1) Detect ALL visible text regions with TIGHT bounding boxes in the provided image.",
      "2) Each bbox uses absolute pixel coordinates relative to the original image: x,y,width,height (integers).",
      "3) Ensure bboxes are fully within image bounds and tightly wrap the text (no excessive padding).",
      "4) Provide the original text and its **Korean translation**.",
      "5) For each detected text box, ESTIMATE the font size in pixels (integer) relative to the original image. If uncertain, provide your best estimate.",
      "6) For each detected text box, ESTIMATE the color of the text in hex format (e.g., #000000). If uncertain, provide your best estimate.",
      "7) Return STRICT JSON with this schema (no extra text):",
      '{"boxes":[{"id":"string","bbox":{"x":number,"y":number,"width":number,"height":number},"original":"string","translated":"string","fontSize":number,"color":string}]}',
    ].join("\n"),

    inlineData: {
      data: img.dataBase64,
      mimeType: img.mimeType,
    },

    imgId: img.id,
  }));

  const results: AnalyzeImageResult[] = [];

  // Sequential to avoid rate limits; could be parallel with Promise.all if desired
  for (const prompt of prompts) {
    const res = await ai.models.generateContent({
      contents: [
        {
          inlineData: prompt.inlineData,
        },
        {
          text: prompt.text,
        },
      ],
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        responseMimeType: "application/json",
        temperature: 0.2,
      },
      model: input.model || "gemini-2.5-flash",
    });
    console.log(res);
    const text = res.text || "{}";
    console.log(text);
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Try to salvage JSON if wrapped
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        console.error(e);
        throw new Error("Failed to parse model response");
      }
    }

    const imgId = (prompt as any).imgId as string;
    const boxes: AnalyzedTextBox[] = Array.isArray(parsed?.boxes)
      ? parsed.boxes
          .filter((b: any) => b && b.bbox && typeof b.original === "string")
          .map((b: any, idx: number) => ({
            id: b.id || `${imgId}-${idx}`,
            bbox: {
              x: Number(b.bbox.x) || 0,
              y: Number(b.bbox.y) || 0,
              width: Number(b.bbox.width) || 0,
              height: Number(b.bbox.height) || 0,
            },
            color: b.color || "#333333",
            original: String(b.original || ""),
            translated: String(b.translated || ""),
            fontSize: Number.isFinite(Number(b.fontSize)) ? Math.round(Number(b.fontSize)) : undefined,
          }))
      : [];

    results.push({ imageId: imgId, boxes });
  }

  return results;
}

export async function analyzeImagesAction(input: AnalyzeImageInput) {
  try {
    const selectedModel = input.model || "gemini-2.5-flash";
    if (selectedModel.toLowerCase().startsWith("gpt")) {
      const results = await analyzeImagesWithGPT(input, selectedModel);
      return successServerAction("analyzed", { results });
    } else {
      const results = await analyzeImagesWithGemini(input, selectedModel);
      return successServerAction("analyzed", { results });
    }
  } catch (error: any) {
    console.error(error);
    return throwServerAction(error?.message || "analysis_failed");
  }
}
