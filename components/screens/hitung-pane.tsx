"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HitungPane({ counted, onCounted }: { counted: number | null; onCounted: (raw: string) => void }) {
  const [text, setText] = useState(counted == null ? "" : String(counted));
  return (
    <div className="rise">
      <h1 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">Hitung laci</h1>
      <p className="mt-2 text-sm text-muted-foreground">Hitung uang kertas dan koin yang ada di laci. QRIS tidak dijumlah ke sini.</p>
      <div className="surface-hero mt-5 p-5">
        <Label htmlFor="counted-cash" className="block text-sm font-semibold">
          Uang yang dihitung di laci
        </Label>
        <Input
          id="counted-cash"
          inputMode="numeric"
          className="money mt-3 h-16 bg-background/70 text-3xl"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onCounted(event.target.value);
          }}
          onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center" })}
        />
      </div>
    </div>
  );
}
