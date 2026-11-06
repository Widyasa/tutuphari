# v3-nav handoff notes

The redesign branch follows the final light-mode handoff. Calculator rules are unchanged.

## Ledger vs calculator

The cash identity matches `closeDay` exactly when the notes are modeled as confirmed cash plus one unresolved sale:

- Modal 200.000 + omzet tunai 120.000 + bayar kasbon 20.000 − gas 25.000 − ambil pribadi 50.000 − kasbon keluar 10.000 = uang laci seharusnya 255.000.
- Omzet tunai 120.000 is not the same figure as total tunai masuk 140.000.
- Es teh 10.000 stays out until chosen. Tunai makes 265.000. QRIS leaves 255.000 and adds QRIS 10.000.
- Counted cash 240.000 before that choice is selisih −15.000. The same −15.000 remains if es teh is QRIS, because QRIS never enters the drawer.

`tests/calculator.test.ts` covers that identity on the raw entries and on the demo day.

## Kasbon Rp45.000

Today's lines alone do not produce outstanding 45.000. Pak Made paying 20.000 cannot leave 15.000 unless an opening balance exists, and Bu Komang has no movement today. The demo stores those openings as `priorKasbon` (Pak Made 35.000, Bu Komang 20.000). Bu Wayan's 10.000 is today's kasbon keluar. The kasbon formula is unchanged.

## Copy and color the mock still shows

- Some earlier PNGs say "Expected" and "entri terkunci". The UI uses "Uang laci seharusnya" and "Dari catatan yang sudah dikonfirmasi".
- The riwayat mock colors a surplus with `#9A3412`. That is an amber/brown, which this pass does not use. A surplus is dark ink.
- Gear icons in the HTML are about 36px. Tap targets here are at least 48px.
- "Lanjut cek catatan" stays disabled until Tunai or QRIS is chosen. "Lanjut hitung laci" stays disabled until every note is confirmed. The static mock draws those buttons as if they were already active.

## Demo history

Riwayat includes two synthetic closed days with no kasbon (5 Nov pas, 4 Nov lebih 8.000) so the book stays Rp45.000. They are labels for the screen, not extra calculator rules.
