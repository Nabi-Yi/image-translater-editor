export type EditorImage = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string; // full data URL
  width?: number;
  height?: number;
};

export type BoundingBox = { x: number; y: number; width: number; height: number; angle?: number };

export type TextItem = {
  id: string;
  bbox: BoundingBox;
  original: string;
  translated: string;
  fontSize?: number;
  blur: number; // px
  visible: boolean;
  color?: string; // hex color for text overlay
  angle?: number; // degrees
  padding?: number; // px, blur range around text box
};
