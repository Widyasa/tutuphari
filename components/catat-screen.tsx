"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EntryCard } from "@/components/entry-card";
import type { DayRecord, Entry } from "@/lib/types";

const EXAMPLES = [
  "jual nasi campur 3 x 15rb tunai",
  "es teh 2 qris 10rb",
  "ambil 50rb buat rumah",
  "bu komang kasbon kopi 10rb",
];

type SpeechCtor = new () => {
  lang: string;
  start: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function CatatScreen({
  day,
  readingId,
  onSend,
  onConfirm,
  onPatch,
  onDelete,
  onConfirmClear,
}: {
  day: DayRecord;
  readingId: string | null;
  onSend: (text: string) => Promise<void>;
  onConfirm: (id: string, patch?: Partial<Entry>) => void;
  onPatch: (id: string, patch: Partial<Entry>) => void;
  onDelete: (id: string) => void;
  onConfirmClear: () => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const clearCount = day.entries.filter(
    (entry) => entry.status === "draft" && !entry.needsConfirmation,
  ).length;

  async function submit() {
    const next = text.trim();
    if (!next || readingId) return;
    if (next.length > 8000) {
      setVoiceError("Terlalu panjang. Kirim sebagian dulu.");
      return;
    }
    setText("");
    await onSend(next);
  }

  function listen() {
    const host = window as Window & {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("Browser ini tidak punya suara. Ketik saja.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "id-ID";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setText((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => setVoiceError("Suara tidak tertangkap. Ketik saja.");
    recognition.onend = () => setListening(false);
    setVoiceError(null);
    setListening(true);
    recognition.start();
  }

  return (
    <div>
      {day.notes.length === 0 && (
        <div className="mb-4">
          <p>Belum ada catatan. Tulis seperti pesan WA, satu kejadian saja.</p>
          <div className="mt-3 grid gap-2">
            {EXAMPLES.map((example) => (
              <Button
                key={example}
                type="button"
                variant="outline"
                className="h-auto min-h-12 whitespace-normal py-2 text-left"
                onClick={() => setText(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ol className="grid gap-4">
        {day.notes.map((note) => {
          const entries = day.entries.filter((entry) => entry.noteId === note.id);
          return (
            <li key={note.id} className="grid gap-2">
              <p className="ml-8 rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground">
                {note.text}
              </p>
              {note.warning && <p className="ml-8 text-sm">{note.warning}</p>}
              {entries.length === 0 && readingId === note.id && (
                <p className="rounded-xl border border-border bg-card p-3">Lagi dibaca…</p>
              )}
              {entries.length === 0 && readingId !== note.id && (
                <p className="rounded-xl border border-border bg-card p-3">
                  Tidak ada transaksi yang terbaca. Tambah nominalnya, misalnya 15rb.
                </p>
              )}
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  isDemo={day.isDemo}
                  onConfirm={(patch) => onConfirm(entry.id, patch)}
                  onPatch={(patch) => onPatch(entry.id, patch)}
                  onDelete={() => onDelete(entry.id)}
                />
              ))}
            </li>
          );
        })}
      </ol>

      {clearCount > 0 && (
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={onConfirmClear}>
          Catat semua yang jelas ({clearCount})
        </Button>
      )}

      <form
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="mx-auto grid max-w-md gap-2 px-4 py-3">
          <label className="sr-only" htmlFor="catatan">
            Catatan baru
          </label>
          <Textarea
            id="catatan"
            rows={2}
            placeholder="jual nasi campur 3 x 15rb tunai"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {voiceError && <p className="text-sm text-short">{voiceError}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={listening}
              onClick={listen}
            >
              {listening ? "Dengar…" : "Suara"}
            </Button>
            <Button type="submit" disabled={readingId !== null || text.trim().length === 0}>
              {readingId ? "Membaca…" : "Kirim"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
