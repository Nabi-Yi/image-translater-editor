"use client";
import dynamic from "next/dynamic";

const EditorPage = dynamic(() => import("./editor-page"), { ssr: false });

export default function Page() {
  return <EditorPage />;
}
