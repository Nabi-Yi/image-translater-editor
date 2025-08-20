"use client";

import { create } from "zustand";
import { EditorImage, TextItem } from "@/types/editor";

export type EditorState = {
  images: EditorImage[];
  activeImageId: string | null;
  itemsByImageId: Record<string, TextItem[]>;
  setImages: (images: EditorImage[]) => void;
  setActiveImage: (id: string | null) => void;
  setItemsForImage: (id: string, items: TextItem[]) => void;
  updateItem: (imageId: string, itemId: string, updater: (prev: TextItem) => TextItem) => void;
  removeItem: (imageId: string, itemId: string) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  images: [],
  activeImageId: null,
  itemsByImageId: {},
  setImages: (images) => set({ images, activeImageId: images[0]?.id ?? null }),
  setActiveImage: (id) => set({ activeImageId: id }),
  setItemsForImage: (id, items) => set((state) => ({ itemsByImageId: { ...state.itemsByImageId, [id]: items } })),
  updateItem: (imageId, itemId, updater) =>
    set((state) => {
      const list = state.itemsByImageId[imageId] || [];
      const next = list.map((it) => (it.id === itemId ? updater(it) : it));
      return { itemsByImageId: { ...state.itemsByImageId, [imageId]: next } };
    }),
  removeItem: (imageId, itemId) =>
    set((state) => {
      const list = state.itemsByImageId[imageId] || [];
      const next = list.filter((it) => it.id !== itemId);
      return { itemsByImageId: { ...state.itemsByImageId, [imageId]: next } };
    }),
}));
