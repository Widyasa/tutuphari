"use client";

import { StartScreen } from "@/components/start-screen";

export function OpenScreen({
  onStart,
  onDemo,
}: {
  onStart: (warungName: string, modalAwal: number) => void;
  onDemo: () => void;
}) {
  return <StartScreen onStart={onStart} onDemo={onDemo} />;
}
