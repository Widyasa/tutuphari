"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { MethodChoice } from "@/components/screens/method-choice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compactRb, draftMoneyLabel } from "@/components/ui-tokens";
import { cashSign } from "@/lib/calculator";
import { draftShowsMethod, draftShowsName, normalizeDraftEdit } from "@/lib/draft-edit";
import { formatRupiah, parseMoneyInput } from "@/lib/rupiah";
import { isEntryType, isMethod, METHOD_LABEL, TYPE_LABEL, type DayRecord, type Entry, type EntryType, type Method } from "@/lib/types";
import { cn } from "@/lib/utils";

function DraftCardTools({
  entry,
  blocked,
  onConfirm,
  onUpdate,
  onDelete,
}: {
  entry: Entry;
  blocked: { title: "Belum bisa dikonfirmasi"; detail: string } | null;
  onConfirm: (id: string) => void;
  onUpdate: (id: string, patch: ReturnType<typeof normalizeDraftEdit>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [type, setType] = useState<EntryType>(entry.type);
  const [amountText, setAmountText] = useState(entry.amount == null ? "" : formatRupiah(entry.amount));
  const [method, setMethod] = useState<Method>(entry.method === "transfer" ? "transfer" : entry.method);
  const [name, setName] = useState(entry.counterparty ?? "");
  const alertRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const alertId = `draft-alert-${entry.id}`;
  const showMethod = draftShowsMethod(type);
  const showName = draftShowsName(type);
  const typeLabel = type === "lainnya" ? "Belum diketahui" : TYPE_LABEL[type];

  function beginEdit() {
    setType(entry.type);
    setAmountText(entry.amount == null ? "" : formatRupiah(entry.amount));
    setMethod(entry.method);
    setName(entry.counterparty ?? "");
    setSavedNote(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function saveEdit() {
    const amount = parseMoneyInput(amountText);
    if (amount == null || amount <= 0) return;
    onUpdate(entry.id, normalizeDraftEdit({ type, amount, method, name }));
    setEditing(false);
    setSavedNote("Perubahan disimpan sebagai draft");
  }

  const fieldError = editing && parseMoneyInput(amountText) == null;
  return (
    <div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Catatan asli.</span> “{entry.sourceText}”
      </p>
      {blocked && !editing && (
        <div
          id={alertId}
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="alert-surface mt-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--short)]"
        >
          <p className="font-semibold">{blocked.title}</p>
          <p>{blocked.detail}</p>
        </div>
      )}
      {savedNote && !editing && (
        <p className="ok-text mt-3 text-sm font-semibold" role="status">
          {savedNote}
        </p>
      )}
      {editing ? (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="lg:col-span-1">
            <Label htmlFor={`draft-type-${entry.id}`}>Jenis catatan</Label>
            <select
              id={`draft-type-${entry.id}`}
              className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-3"
              value={type}
              onChange={(event) => {
                if (isEntryType(event.target.value)) setType(event.target.value);
              }}
            >
              {(Object.keys(TYPE_LABEL) as EntryType[]).map((value) => (
                <option key={value} value={value}>
                  {value === "lainnya" ? "Belum diketahui" : TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`draft-amount-${entry.id}`}>Jumlah</Label>
            <Input
              id={`draft-amount-${entry.id}`}
              inputMode="numeric"
              className="money mt-2 h-12"
              value={amountText}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={blocked ? alertId : undefined}
              onChange={(event) => setAmountText(event.target.value)}
            />
          </div>
          {showMethod && (
            <div>
              <Label htmlFor={`draft-method-${entry.id}`}>Cara bayar</Label>
              <select
                id={`draft-method-${entry.id}`}
                className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-3"
                value={method === "transfer" ? "transfer" : method}
                onChange={(event) => {
                  if (isMethod(event.target.value)) setMethod(event.target.value);
                }}
              >
                <option value="tunai">Tunai</option>
                <option value="qris">QRIS</option>
                <option value="tidak_tahu">Belum diketahui</option>
                {method === "transfer" && <option value="transfer">Transfer</option>}
              </select>
            </div>
          )}
          {showName && (
            <div>
              <Label htmlFor={`draft-name-${entry.id}`}>Nama</Label>
              <Input
                id={`draft-name-${entry.id}`}
                className="mt-2 h-12"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2 lg:col-span-2 lg:flex-row">
            <Button type="button" className="h-12 lg:flex-1" disabled={parseMoneyInput(amountText) == null} onClick={saveEdit}>
              Simpan perubahan
            </Button>
            <Button type="button" variant="outline" className="h-12 lg:flex-1" onClick={cancelEdit}>
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 lg:flex-row">
          <Button type="button" variant="outline" className="h-12 lg:flex-1" onClick={beginEdit}>
            Ubah catatan
          </Button>
          <Button
            ref={deleteRef}
            type="button"
            variant="ghost"
            className="h-12 text-[var(--short)] hover:text-[var(--short)] lg:flex-1"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden />
            Hapus draft
          </Button>
        </div>
      )}
      {!editing && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-12 w-full"
          aria-invalid={blocked ? true : undefined}
          aria-describedby={blocked ? alertId : undefined}
          onClick={() => {
            onConfirm(entry.id);
            if (blocked) alertRef.current?.focus();
          }}
        >
          Konfirmasi catatan ini
        </Button>
      )}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) deleteRef.current?.focus();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Hapus draft {typeLabel} {draftMoneyLabel(entry.amount, false)}?
            </DialogTitle>
            <DialogDescription>Catatan lain tetap tersimpan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                onDelete(entry.id);
              }}
            >
              Hapus draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function KonfirmasiPane({
  day,
  expected,
  omzet,
  masuk,
  keluar,
  onConfirm,
  onChoose,
  onUpdate,
  onDelete,
  blockFor,
}: {
  day: DayRecord;
  expected: number;
  omzet: number;
  masuk: number;
  keluar: number;
  onConfirm: (id: string) => void;
  onChoose: (id: string, method: "tunai" | "qris") => void;
  onUpdate: (id: string, patch: ReturnType<typeof normalizeDraftEdit>) => void;
  onDelete: (id: string) => void;
  blockFor: (entry: Entry) => { title: "Belum bisa dikonfirmasi"; detail: string } | null;
}) {
  return (
    <div className="rise">
      <h1 id="cek-heading" tabIndex={-1} className="text-2xl font-bold tracking-[-0.02em] outline-none md:text-3xl">
        Cek sebelum tutup
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Uang laci seharusnya {formatRupiah(expected)} (modal {compactRb(day.modalAwal)} + tunai masuk {compactRb(masuk)} − keluar{" "}
        {compactRb(keluar)}). Omzet tunai {formatRupiah(omzet)}, bukan total tunai masuk.
      </p>
      <ul className="mt-4 grid gap-3">
        {[...day.entries]
          .sort((a, b) => Number(b.status !== "confirmed") - Number(a.status !== "confirmed"))
          .map((entry) => {
            const sign = cashSign(entry.type);
            const negative = entry.method === "tunai" && sign != null && sign < 0;
            const open = entry.status !== "confirmed" || entry.needsConfirmation || entry.method === "tidak_tahu";
            return (
              <li key={entry.id} className={cn("surface p-4", open ? "border-[var(--short)]/50 ring-1 ring-[var(--short)]/15" : "")}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {entry.method === "tidak_tahu" ? "Belum dipilih" : `${METHOD_LABEL[entry.method]} · ${TYPE_LABEL[entry.type]}`}
                  </span>
                  {entry.status === "confirmed" && <span className="ok-text text-xs font-semibold">Sudah dikonfirmasi</span>}
                </div>
                <p className="money mt-1 text-2xl font-bold">{draftMoneyLabel(entry.amount, negative)}</p>
                <p className="text-sm text-muted-foreground">“{entry.sourceText}”</p>
                {entry.question && <p className="mt-2 text-sm leading-relaxed text-[var(--short)]">{entry.question}</p>}
                {entry.method === "tidak_tahu" && <MethodChoice method={null} onMethod={(method) => onChoose(entry.id, method)} />}
                {entry.status !== "confirmed" && !day.closedAt && (
                  <DraftCardTools
                    entry={entry}
                    blocked={blockFor(entry)}
                    onConfirm={onConfirm}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
