"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/money-field";
import { formatRupiah } from "@/lib/rupiah";
import {
  ENTRY_TYPES,
  METHOD_LABEL,
  METHODS,
  TYPE_LABEL,
  type Entry,
  type Method,
} from "@/lib/types";
import { cn } from "cn";

const PARSER_LABEL = {
  ai: "AI",
  rule: "Tanpa AI",
  demo: "Contoh",
} as const;

export function EntryCard({
  entry,
  isDemo,
  onConfirm,
  onPatch,
  onDelete,
}: {
  entry: Entry;
  isDemo: boolean;
  onConfirm: (patch?: Partial<Entry>) => void;
  onPatch: (patch: Partial<Entry>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(entry.amount == null);
  const [armed, setArmed] = useState(false);
  const open = entry.needsConfirmation && entry.status !== "confirmed";

  function chooseMethod(method: Method) {
    if (entry.amount == null) {
      onPatch({ method, needsConfirmation: true, question: "Nominalnya berapa?" });
      setEditing(true);
      return;
    }
    onConfirm({ method });
  }

  return (
    <article
      className={cn(
        "rounded-xl border p-3",
        open ? "border-warn-ink bg-warn" : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-sm font-bold text-secondary-foreground">
          {TYPE_LABEL[entry.type]}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-sm font-bold",
            entry.method === "qris"
              ? "bg-qris/15 text-qris"
              : entry.method === "tidak_tahu"
                ? "bg-warn-ink text-white"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          {METHOD_LABEL[entry.method]}
        </span>
        <span className="text-sm">{PARSER_LABEL[entry.parser]}</span>
        {entry.status === "draft" && <span className="text-sm font-bold">Belum dihitung</span>}
      </div>

      <p className="money mt-2 text-3xl">
        {entry.amount == null ? "Nominal?" : formatRupiah(entry.amount)}
      </p>
      <p className="mt-1">
        {[entry.item, entry.qty ? `× ${entry.qty}` : null, entry.counterparty]
          .filter(Boolean)
          .join(" · ") || "Tanpa nama barang"}
      </p>
      <p className="mt-2 text-sm text-foreground">
        Dari catatan: <q>{entry.sourceText}</q>
      </p>

      {open && entry.question && (
        <p className="mt-3 font-bold text-warn-ink">{entry.question}</p>
      )}
      {isDemo && entry.id === "demo-entry-7" && entry.status === "draft" && (
        <p className="mt-2">
          Coba pilih Tunai. Di Tutup hari, selisihnya jadi pas.
        </p>
      )}

      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Metode bayar">
          {(["tunai", "qris", "transfer"] as const).map((method) => (
            <Button
              key={method}
              type="button"
              variant={entry.method === method ? "default" : "outline"}
              onClick={() => chooseMethod(method)}
            >
              {METHOD_LABEL[method]}
            </Button>
          ))}
        </div>
      )}

      {entry.status === "draft" && !entry.needsConfirmation && (
        <Button type="button" className="mt-3 w-full" onClick={() => onConfirm()}>
          Sudah benar
        </Button>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing((value) => !value)}>
          {editing ? "Tutup ubah" : "Ubah"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            onDelete();
          }}
        >
          {armed ? "Yakin hapus" : "Hapus"}
        </Button>
      </div>

      {editing && (
        <EditForm
          entry={entry}
          onSave={(patch) => {
            if (patch.amount == null) {
              onPatch({ ...patch, needsConfirmation: true, question: "Nominalnya berapa?", status: "draft" });
            } else {
              onConfirm(patch);
            }
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}

function EditForm({
  entry,
  onSave,
}: {
  entry: Entry;
  onSave: (patch: Partial<Entry>) => void;
}) {
  const [type, setType] = useState(entry.type);
  const [amount, setAmount] = useState<number | null>(entry.amount);
  const [method, setMethod] = useState<Method>(entry.method);
  const [item, setItem] = useState(entry.item ?? "");
  const [person, setPerson] = useState(entry.counterparty ?? "");

  return (
    <form
      className="mt-3 grid gap-3 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          type,
          amount,
          method,
          item: item.trim() || null,
          counterparty: person.trim() || null,
        });
      }}
    >
      <label className="grid gap-1 text-base font-medium">
        Jenis
        <select
          className="h-12 rounded-lg border border-input bg-card px-3 text-base"
          value={type}
          onChange={(event) => setType(event.target.value as Entry["type"])}
        >
          {ENTRY_TYPES.map((option) => (
            <option key={option} value={option}>
              {TYPE_LABEL[option]}
            </option>
          ))}
        </select>
      </label>
      <MoneyField id={`amount-${entry.id}`} label="Nominal" value={amount} onChange={setAmount} />
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Metode">
        {METHODS.map((option) => (
          <Button
            key={option}
            type="button"
            variant={method === option ? "default" : "outline"}
            onClick={() => setMethod(option)}
          >
            {METHOD_LABEL[option]}
          </Button>
        ))}
      </div>
      <label className="grid gap-1 text-base font-medium">
        Barang
        <Input value={item} onChange={(event) => setItem(event.target.value)} />
      </label>
      <label className="grid gap-1 text-base font-medium">
        Nama orang
        <Input
          value={person}
          placeholder="Bu Wayan"
          onChange={(event) => setPerson(event.target.value)}
        />
      </label>
      <p className="text-sm">Keyakinan pembacaan {Math.round(entry.confidence * 100)}%.</p>
      <Button type="submit">Simpan ubahan</Button>
    </form>
  );
}
