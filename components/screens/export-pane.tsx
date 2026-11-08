"use client";

export function ExportPane({ text }: { text: string }) {
  return (
    <div className="rise">
      <h1 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">Bagikan rekap</h1>
      <pre className="surface mt-4 overflow-x-hidden p-4 text-sm leading-relaxed whitespace-pre-wrap md:p-5">{text}</pre>
    </div>
  );
}
