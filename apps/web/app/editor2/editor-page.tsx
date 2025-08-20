"use client";

import React from "react";
import { useEditorStore } from "@/hooks/useEditorStore";
import type { EditorImage, TextItem } from "@/types/editor";
import { Canvas, FabricImage, Rect, Textbox, filters } from "fabric";

type AnalyzeImageInput = {
  images: Array<{
    mimeType: string;
    dataBase64: string;
    id: string;
  }>;
  model?: string;
};

type AnalyzeImageResultBox = {
  id: string;
  bbox: { x: number; y: number; width: number; height: number };
  original: string;
  translated: string;
  fontSize?: number;
  color?: string;
};

type AnalyzeImagesResponse = {
  status: "success" | "error";
  message: string;
  data: {
    results: Array<{
      imageId: string;
      boxes: AnalyzeImageResultBox[];
    }>;
  } | null;
};

function moveToFront(canvas: any, obj: any) {
  if (obj && typeof obj.bringToFront === "function") {
    obj.bringToFront();
    return;
  }
  if (canvas && typeof canvas.bringToFront === "function") {
    canvas.bringToFront(obj);
    return;
  }
  // Fallback: remove and re-add to push to top
  const objects = canvas.getObjects();
  const index = typeof objects.indexOf === "function" ? objects.indexOf(obj) : -1;
  if (index > -1 && index !== objects.length - 1) {
    canvas.remove(obj);
    canvas.add(obj);
  }
}

export default function EditorPage2() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const canvasElRef = React.useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = React.useRef<any>(null);
  const baseImageRef = React.useRef<any>(null);
  const rebuildingRef = React.useRef<boolean>(false);
  const overlaysRef = React.useRef<Record<string, any>>({});

  const { images, activeImageId, itemsByImageId, setImages, setActiveImage, setItemsForImage, updateItem, removeItem } =
    useEditorStore();

  const [selectedModel, setSelectedModel] = React.useState<string>("gemini-2.5-flash");
  const [isTranslating, setIsTranslating] = React.useState<boolean>(false);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const [isCanvasReady, setIsCanvasReady] = React.useState<boolean>(false);

  const activeImage: EditorImage | undefined = React.useMemo(
    () => images.find((img) => img.id === activeImageId),
    [images, activeImageId],
  );

  const activeItems: TextItem[] = React.useMemo(
    () => itemsByImageId[activeImageId ?? ""] || [],
    [itemsByImageId, activeImageId],
  );

  const selectedItem: TextItem | undefined = React.useMemo(
    () => activeItems.find((it) => it.id === selectedItemId),
    [activeItems, selectedItemId],
  );

  const handleUploadClick = (): void => {
    fileInputRef.current?.click();
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getImageNaturalSize = (dataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const nextImages: EditorImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readFileAsDataUrl(file);
      const size = await getImageNaturalSize(dataUrl);
      nextImages.push({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        dataUrl,
        width: size.width,
        height: size.height,
      });
    }
    if (nextImages.length > 0) {
      setImages(nextImages);
    }
    // reset input
    e.target.value = "";
  };

  // Initialize fabric canvas when active image changes
  React.useEffect(() => {
    let isCancelled = false;
    (async () => {
      if (!canvasElRef.current) return;

      setIsCanvasReady(false);

      // Dispose previous
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        baseImageRef.current = null;
        overlaysRef.current = {};
        setSelectedItemId(null);
      }

      const canvas = new Canvas(canvasElRef.current, {
        selection: false,
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;

      // Register selection listeners
      const onSelectionChange = () => {
        if (rebuildingRef.current) return;
        const active = canvas.getActiveObject() as any;
        if (!active || active === baseImageRef.current) {
          setSelectedItemId(null);
        } else {
          setSelectedItemId(active.itemId ?? null);
        }
      };
      const onSelectionCleared = () => {
        if (rebuildingRef.current) return;
        setSelectedItemId(null);
      };
      canvas.on("selection:created", onSelectionChange);
      canvas.on("selection:updated", onSelectionChange);
      canvas.on("selection:cleared", onSelectionCleared);

      if (!activeImage) return;

      // Load base image
      const baseImg = await FabricImage.fromURL(activeImage.dataUrl, { crossOrigin: "anonymous" });
      if (isCancelled || !baseImg) return;
      canvas.setWidth(activeImage.width || baseImg.getScaledWidth());
      canvas.setHeight(activeImage.height || baseImg.getScaledHeight());
      baseImg.set({ selectable: false, evented: false, left: 0, top: 0, originX: "left", originY: "top" });
      baseImageRef.current = baseImg;
      canvas.add(baseImg);

      // Previously: single blurred overlay image with union clip. Removed in favor of per-item overlays.

      canvas.renderAll();
      setIsCanvasReady(true);
    })();
    return () => {
      isCancelled = true;
    };
  }, [activeImage?.id]);

  // Render items (text boxes + blur clips) whenever items change
  React.useEffect(() => {
    (async () => {
      const canvas = fabricCanvasRef.current as import("fabric").Canvas | null;
      if (!canvas || !isCanvasReady) return;

      rebuildingRef.current = true;

      // Remove previous text objects (keep images)
      const toRemove = canvas.getObjects().filter((o: any) => o !== baseImageRef.current);
      toRemove.forEach((o: any) => canvas.remove(o));

      // Add text boxes and per-item blur overlays
      overlaysRef.current = {};
      for (const it of activeItems) {
        if (it.visible === false) continue;
        const padding = Math.max(0, Math.round(it.padding ?? 8));
        const overlay = await baseImageRef.current.clone();
        overlay.set({ selectable: false, evented: false, left: 0, top: 0, originX: "left", originY: "top" });
        const BlurFilter = (filters as any)?.Blur;
        if (BlurFilter) {
          overlay.filters = [new BlurFilter({ blur: Math.min(1, Math.max(0.01, (it.blur ?? 16) / 30)) })];
          overlay.applyFilters();
        }
        overlay.clipPath = new Rect({
          left: it.bbox.x - padding,
          top: it.bbox.y - padding,
          width: it.bbox.width + padding * 2,
          height: it.bbox.height + padding * 2,
          absolutePositioned: true,
          originX: "left",
          originY: "top",
          angle: it.angle || 0,
        }) as any;
        overlaysRef.current[it.id] = overlay;
        canvas.add(overlay);

        const textbox = new Textbox(it.translated || "", {
          left: it.bbox.x,
          top: it.bbox.y,
          width: it.bbox.width || 0,
          fontSize: it.fontSize || Math.round(it.bbox.height / 2),
          // height: it.bbox.height || 0,
          fill: it.color || "#FFF",
          editable: true,
          backgroundColor: "rgba(255,255,255,0)",
          borderColor: "#4f46e5",
          cornerColor: "#4f46e5",
          cornerStyle: "circle",
          transparentCorners: false,
          padding: 0,
          originX: "left",
          originY: "top",
          angle: it.angle || 0,
          textAlign: "center",
        });
        (textbox as any).itemId = it.id;
        textbox.set({ lockScalingY: true, lockRotation: false });

        const syncOverlay = () => {
          const itemId = (textbox as any).itemId as string;
          const ov = overlaysRef.current[itemId];
          if (!ov) return;
          const currentPadding = Math.max(0, Math.round(activeItems.find((x) => x.id === itemId)?.padding ?? 8));
          const left = Math.round(textbox.left ?? it.bbox.x);
          const top = Math.round(textbox.top ?? it.bbox.y);
          const width = Math.round((textbox as any).getScaledWidth?.() ?? textbox.width ?? it.bbox.width);
          // const height = Math.round((textbox as any).getScaledHeight?.() ?? (textbox as any).height ?? it.bbox.height);
          // const width = it.bbox.width;
          const height = it.bbox.height;
          ov.clipPath = new Rect({
            left: left - currentPadding * 4,
            top: top - currentPadding * 4,
            width: width + currentPadding * 2,
            height: height + currentPadding * 2,
            absolutePositioned: true,
            originX: "left",
            originY: "top",
            angle: (textbox as any).angle || 0,
          }) as any;
          ov.dirty = true;
        };

        textbox.on("changed", () => {
          // 입력 중에는 전역 상태를 갱신하지 않고, 오버레이와 캔버스만 동기화하여 포커스를 유지한다
          syncOverlay();
          canvas.requestRenderAll();
        });

        textbox.on("editing:exited", () => {
          const itemId = (textbox as any).itemId as string;
          const newLeft = textbox.left ?? 0;
          const newTop = textbox.top ?? 0;
          const scaledWidth = (textbox as any).getScaledWidth?.() ?? textbox.width ?? 0;
          // const scaledHeight = (textbox as any).getScaledHeight?.() ?? (textbox as any).height ?? 0;
          // const scaledWidth = it.bbox.width;
          const scaledHeight = it.bbox.height;
          updateItem(activeImageId as string, itemId, (prev) => ({
            ...prev,
            translated: textbox.text || "",
            bbox: {
              x: Math.round(newLeft),
              y: Math.round(newTop),
              width: Math.round(scaledWidth || prev.bbox.width),
              height: Math.round(scaledHeight || prev.bbox.height),
            },
            angle: Math.round((textbox as any).angle ?? prev.angle ?? 0),
          }));
          syncOverlay();
          canvas.requestRenderAll();
        });

        textbox.on("modified", () => {
          const itemId = (textbox as any).itemId as string;
          const newLeft = textbox.left ?? 0;
          const newTop = textbox.top ?? 0;
          const scaledWidth = (textbox as any).getScaledWidth?.() ?? textbox.width ?? it.bbox.width;
          // const scaledHeight = (textbox as any).getScaledHeight?.() ?? (textbox as any).height ?? it.bbox.height;
          // const scaledWidth = it.bbox.width;
          const scaledHeight = it.bbox.height;
          const newAngle = (textbox as any).angle ?? 0;
          textbox.set({ scaleX: 1, width: scaledWidth, scaleY: 1 });
          updateItem(activeImageId as string, itemId, (prev) => ({
            ...prev,
            bbox: {
              x: Math.round(newLeft),
              y: Math.round(newTop),
              width: Math.round(scaledWidth),
              height: Math.round(scaledHeight),
            },
            angle: Math.round(newAngle),
          }));
          syncOverlay();
          canvas.requestRenderAll();
        });

        canvas.add(textbox);
        moveToFront(canvas, textbox);
      }

      // Reselect previously selected textbox to keep focus and selection stable
      if (selectedItemId) {
        const objs = canvas.getObjects();
        const target = objs.find((o: any) => (o as any).itemId === selectedItemId);
        if (target) {
          canvas.setActiveObject(target as any);
        }
      }

      rebuildingRef.current = false;
      // leave blurred overlay below text boxes
      canvas.requestRenderAll();
    })();
  }, [activeItems, activeImageId, isCanvasReady]);

  // Delete selected textbox with Delete/Backspace keys
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const canvas = fabricCanvasRef.current as import("fabric").Canvas | null;
      if (!canvas) return;
      const active = canvas.getActiveObject() as any;
      if (!active || active === baseImageRef.current || active === overlaysRef.current[selectedItemId as string])
        return;
      // Avoid deleting while editing text
      if (typeof (active as any).isEditing === "boolean" && (active as any).isEditing) return;
      const itemId = (active as any).itemId as string | undefined;
      if (!itemId || !activeImageId) return;
      removeItem(activeImageId, itemId);
      canvas.remove(active);
      canvas.requestRenderAll();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeImageId, removeItem]);

  // Add text boxes
  // existing: within items effect

  // Delete selected textbox handler (also available via toolbar button)
  const handleDeleteSelected = React.useCallback(() => {
    const canvas = fabricCanvasRef.current as import("fabric").Canvas | null;
    if (!canvas || !activeImageId) return;
    const active = canvas.getActiveObject() as any;
    if (!active || active === baseImageRef.current || active === overlaysRef.current[selectedItemId as string]) return;
    // Avoid deleting while editing text
    if (typeof (active as any).isEditing === "boolean" && (active as any).isEditing) return;
    const itemId = (active as any).itemId as string | undefined;
    if (!itemId) return;
    removeItem(activeImageId, itemId);
    canvas.remove(active);
    setSelectedItemId(null);
    canvas.requestRenderAll();
  }, [activeImageId, removeItem]);

  const handleTranslate = async (): Promise<void> => {
    if (images.length === 0) return;
    try {
      setIsTranslating(true);
      const payload: AnalyzeImageInput = {
        images: images.map((img) => ({
          id: img.id,
          mimeType: img.mimeType,
          dataBase64: img.dataUrl.split(",")[1] || "",
        })),
        model: selectedModel,
      };

      const res = await fetch("/api/analyze2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: AnalyzeImagesResponse = await res.json();
      if (json.status !== "success" || !json.data) throw new Error(json.message || "analysis_failed");

      json.data.results.forEach((r) => {
        const items: TextItem[] = r.boxes.map((b) => ({
          id: b.id,
          bbox: { x: b.bbox.x, y: b.bbox.y, width: b.bbox.width, height: b.bbox.height },
          original: b.original,
          translated: b.translated,
          fontSize: b.fontSize || Math.round(b.bbox.height / 2),
          blur: 16,
          padding: 8,
          visible: true,
          color: b.color || "#111111",
        }));
        console.log(items);
        setItemsForImage(r.imageId, items);
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "번역 중 오류가 발생했습니다.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownload = (): void => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !activeImage) return;
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${activeImage.name.replace(/\.[^.]+$/, "") || "image"}-translated.png`;
    link.click();
  };

  const handleFontSizeChange = (value: number): void => {
    if (!activeImageId || !selectedItemId) return;
    const fontSize = Math.max(1, Math.min(200, Math.round(value || 0)));
    const canvas = fabricCanvasRef.current as import("fabric").Canvas | null;
    if (canvas) {
      const active = canvas.getActiveObject() as any;
      if (active && active.itemId === selectedItemId) {
        active.set({ fontSize });
        if (typeof (active as any).initDimensions === "function") {
          (active as any).initDimensions();
        }
        canvas.requestRenderAll();
        updateItem(activeImageId, selectedItemId, (prev) => ({
          ...prev,
          fontSize,
        }));
        return;
      }
    }
    updateItem(activeImageId, selectedItemId, (prev) => ({ ...prev, fontSize }));
  };

  const handlePaddingChange = (value: number): void => {
    if (!activeImageId || !selectedItemId) return;
    const padding = Math.max(0, Math.round(value || 0));
    updateItem(activeImageId, selectedItemId, (prev) => ({
      ...prev,
      padding,
    }));
    const canvas = fabricCanvasRef.current as Canvas | null;
    if (canvas) {
      const active = canvas.getActiveObject() as any;
      const overlay = overlaysRef.current[selectedItemId];
      if (active && overlay) {
        const left = Math.round((active.left ?? 0) - padding * 10);
        const top = Math.round((active.top ?? 0) - padding * 10);
        const width = Math.round((active as any).getScaledWidth?.() ?? active.width ?? 0);
        const height = Math.round((active as any).getScaledHeight?.() ?? (active as any).height ?? 0);
        overlay.clipPath = new Rect({
          left: left - padding,
          top: top - padding,
          width: width + padding * 2,
          height: height + padding * 2,
          absolutePositioned: true,
          originX: "left",
          originY: "top",
          angle: (active as any).angle || 0,
        }) as any;
        overlay.dirty = true;
        canvas.requestRenderAll();
      }
    }
  };

  const handleBlurChange = (value: number): void => {
    if (!activeImageId || !selectedItemId) return;
    const blur = Math.max(0, Math.round(value || 0));
    updateItem(activeImageId, selectedItemId, (prev) => ({
      ...prev,
      blur,
    }));
    const canvas = fabricCanvasRef.current as import("fabric").Canvas | null;
    if (canvas) {
      const overlay = overlaysRef.current[selectedItemId];
      const BlurFilter = (filters as any)?.Blur;
      if (overlay && BlurFilter) {
        overlay.filters = [new BlurFilter({ blur: Math.min(1, Math.max(0.01, blur / 30)) })];
        overlay.applyFilters();
        canvas.requestRenderAll();
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r overflow-y-auto">
        <div className="p-3 border-b">
          <button onClick={handleUploadClick} className="w-full rounded bg-indigo-600 text-white py-2 text-sm">
            이미지 업로드
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFilesSelected}
          />
        </div>
        <div className="p-2 space-y-2">
          {images.length === 0 && <div className="text-sm text-gray-500">이미지를 업로드하세요.</div>}
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => setActiveImage(img.id)}
              className={`w-full text-left rounded border overflow-hidden ${activeImageId === img.id ? "ring-2 ring-indigo-600" : ""}`}
            >
              <div className="w-full">
                <img src={img.dataUrl} alt={img.name} className="block w-full h-auto" />
              </div>
              <div className="p-2 text-xs truncate">{img.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 p-3 border-b">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border rounded px-2 py-1 text-sm *:text-black"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
            <option value="gpt-5-nano">GPT-5 Nano</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
          </select>
          <button
            onClick={handleTranslate}
            disabled={isTranslating || images.length === 0}
            className="rounded bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {isTranslating ? "번역 중..." : "번역"}
          </button>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-600">폰트</label>
            <input
              type="number"
              min={1}
              max={200}
              step={1}
              value={selectedItem ? selectedItem.fontSize || 16 : 16}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              disabled={!selectedItemId}
              className="w-20 border rounded px-2 py-1 text-sm disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-600">패딩</label>
            <input
              type="number"
              min={0}
              step={1}
              value={selectedItem ? (selectedItem.padding ?? 8) : 8}
              onChange={(e) => handlePaddingChange(Number(e.target.value))}
              disabled={!selectedItemId}
              className="w-20 border rounded px-2 py-1 text-sm disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-600">블러 강도</label>
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={selectedItem ? (selectedItem.blur ?? 16) : 16}
              onChange={(e) => handleBlurChange(Number(e.target.value))}
              disabled={!selectedItemId}
              className="w-24 border rounded px-2 py-1 text-sm disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedItemId}
            className="rounded bg-rose-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            선택 삭제
          </button>
          <button
            onClick={handleDownload}
            disabled={!activeImage}
            className="rounded bg-gray-800 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            다운로드
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-neutral-100">
          <div className="p-4">
            {activeImage ? (
              <div className="inline-block bg-white shadow border">
                <canvas ref={canvasElRef} />
              </div>
            ) : (
              <div className="text-sm text-gray-500">왼쪽에서 이미지를 선택하세요.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fitFontSizeInRect(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: { x: number; y: number; w: number; h: number },
  fontFamily = "Pretendard",
  min = 10,
  max = 64,
  lineHeight = 1.25,
) {
  const wrap = (t: string, w: number) => {
    const words = t.split(/\s+/);
    let line = "",
      lines: string[] = [];
    for (const word of words) {
      const test = line ? line + " " + word : word;
      const m = ctx.measureText(test);
      if (m.width <= w) line = test;
      else {
        lines.push(line || word);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  let lo = min,
    hi = max,
    best = min,
    bestLines: string[] = [];
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `${mid}px ${fontFamily}`;
    const lines = wrap(text, rect.w);
    const metrics = ctx.measureText("M");
    const lh = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const totalH = lines.length * lh * lineHeight;

    if (totalH <= rect.h) {
      best = mid;
      bestLines = lines;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return { fontSize: best, lines: bestLines };
}
