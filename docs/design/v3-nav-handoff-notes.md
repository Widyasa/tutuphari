# v3-nav handoff notes

The redesign follows the light-mode navigation. Calculator rules and the tested demo fixture are the ones on `e95ef19`. The design ledger is an example, not a replacement fixture.

## Fixture the app actually uses

`createDemoDay` is Warung Bu Komang with the original seven notes:

- Confirmed: nasi campur tunai Rp120.000, es teh QRIS Rp10.000, ambil pribadi Rp50.000, gas Rp25.000, kasbon Bu Wayan Rp10.000, kasbon Pak Made paid Rp20.000.
- Unclear: `es jeruk 15rb`, still out of the drawer.
- Modal Rp200.000. Counted cash Rp270.000. Counted QRIS Rp10.000.
- Uang laci seharusnya before the choice is Rp255.000, so the gap is **lebih Rp15.000**.
- Tunai for es jeruk makes uang laci seharusnya Rp270.000 and the gap pas.
- QRIS for es jeruk leaves uang laci seharusnya at Rp255.000, raises QRIS to Rp25.000, and the gap stays lebih Rp15.000.
- Kasbon: Pak Made's opening Rp20.000 is paid off (outstanding Rp0). Bu Wayan owes Rp10.000.

Omzet tunai Rp120.000 is not the same number as total tunai masuk Rp140.000. The screen shows both.

## What the ledger shows instead

`LEDGER.md` uses different demo numbers. Those screens are examples only:

- The unclear note there is es teh Rp10.000, and there is no separate confirmed QRIS sale.
- Counted cash there is Rp240.000, so the gap before the choice is kurang Rp15.000.
- The kasbon book there is Rp45.000 across Bu Wayan, Pak Made, and Bu Komang. Today's lines plus Pak Made's Rp20.000 opening do not produce that book. It would need extra opening balances. The formula was not changed to force it.
- The same cash rules do reproduce the ledger if the entries are modeled that way. That model is not the demo.

## Copy and color the mock still shows

- Some earlier PNGs say "Expected" and "entri terkunci". The UI uses "Uang laci seharusnya" and "Dari catatan yang sudah dikonfirmasi".
- The riwayat mock colors a surplus with `#9A3412`. That is an amber/brown, which this pass does not use. A surplus is dark ink.
- Gear icons in the HTML are about 36px. Tap targets here are at least 48px.
- "Lanjut cek catatan" stays disabled until Tunai or QRIS is chosen. "Lanjut hitung laci" stays disabled until every note is confirmed. The static mock draws those buttons as if they were already active.

## Older days on Riwayat

Riwayat includes two synthetic closed days with no kasbon (5 Nov pas, 4 Nov lebih Rp8.000). They do not change today's drawer or the kasbon book.
