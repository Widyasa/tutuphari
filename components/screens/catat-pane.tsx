"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CatatPane({ draft, onDraft }: { draft: string; onDraft: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  function listen() {
    const host = window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
    };
    const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("Browser ini tidak punya suara. Ketik saja.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "id-ID";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      onDraft(draft.trim() ? `${draft.trim()} ${transcript}` : transcript);
    };
    recognition.onerror = () => setVoiceError("Suara tidak tertangkap. Ketik saja.");
    recognition.onend = () => setListening(false);
    setVoiceError(null);
    setListening(true);
    recognition.start();
  }

  return (
    <div className="rise">
      <h1 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">Catat</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tulis seperti chat WhatsApp — satu baris atau satu hari sekaligus.</p>
      <div className="surface mt-5 p-4 md:p-5">
        <Label htmlFor="draft-note" className="block text-sm font-semibold">
          Catat seperti chat
        </Label>
        <Textarea
          id="draft-note"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center" })}
          placeholder="contoh: jual kopi 1 gelas 5rb tunai"
          className="mt-2 min-h-36 border-border/80 bg-background/70 text-base"
        />
        {voiceError && (
          <p className="mt-2 text-sm text-[var(--short)]" role="status">
            {voiceError}
          </p>
        )}
        <Button type="button" variant="outline" className="mt-3 h-12 bg-background/70" aria-pressed={listening} onClick={listen}>
          {listening ? "Dengar…" : "Suara"}
        </Button>
      </div>
    </div>
  );
}

export function LoadingPane() {
  return (
    <div className="grid min-h-52 place-items-center text-center" aria-busy="true">
      <div className="surface max-w-sm px-6 py-8">
        <p className="text-lg font-bold tracking-tight">Membaca catatan…</p>
        <p className="mt-2 text-sm text-muted-foreground">Angka baru dihitung setelah kamu konfirmasi.</p>
      </div>
    </div>
  );
}
