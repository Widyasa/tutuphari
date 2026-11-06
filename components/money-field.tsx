"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah, parseMoneyInput } from "@/lib/rupiah";

function formatPlain(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function MoneyField({
  id,
  label,
  value,
  onChange,
  hint,
  large = false,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
  large?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : formatPlain(value));
  const emitted = useRef(value);

  useEffect(() => {
    if (emitted.current === value) return;
    emitted.current = value;
    setText(value == null ? "" : formatPlain(value));
  }, [value]);

  const parsed = parseMoneyInput(text);

  return (
    <div>
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="text"
        autoComplete="off"
        enterKeyHint="done"
        className={large ? "money mt-2 h-14 text-2xl" : "money mt-2 text-xl"}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          const amount = parseMoneyInput(next);
          emitted.current = amount;
          setText(next);
          onChange(amount);
        }}
        onBlur={() => {
          if (parsed != null) setText(formatPlain(parsed));
        }}
      />
      <p className="mt-1 text-sm text-muted-foreground">
        {parsed == null ? (hint ?? "Tulis 200000 atau 200rb.") : `Terbaca ${formatRupiah(parsed)}`}
      </p>
    </div>
  );
}
