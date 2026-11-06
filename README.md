# TutupHari

Catat kayak kirim pesan. Pas warung tutup, langsung tahu uang laci seharusnya berapa, dan selisih mana yang perlu dicek.

TutupHari is a mobile-first closing check for small Bali warungs that do not use a POS. The owner types notes the way they already send a chat message. The app turns those notes into cash, QRIS, personal withdrawals, and kasbon, then computes the cash that should be in the drawer. The owner counts the drawer and sees the gap. Nothing here is an official financial or tax report.

## Problem & Target User

Small warungs mix cash, QRIS, owner withdrawals ("ambil buat rumah"), kasbon, and supplier payments in informal notes. At closing time the owner cannot tell how much cash should be in the drawer, so a shortage goes unexplained.

The person holding the phone is the owner or the cashier: a cheap Android, Bahasa Indonesia, no accounting training, and no wish to create an account. BukuWarung, Catatara, KasKecil, and AgentBuff already exist. TutupHari does not claim to be first. It is the lighter closing check: no install, no login, every figure traced to the note it came from, and a gap that is never forced to zero.

## Key Features

- Open the day with the cash already in the drawer.
- Type free-text notes, or paste a whole day. Optional voice input when the browser supports Indonesian speech recognition.
- Each note becomes cards the owner can accept, edit, or delete. The original sentence stays on the card.
- Ambiguous notes, especially a sale with no payment method, stay out of the total until the owner chooses.
- Tutup hari: counted cash in, expected cash and selisih out. QRIS is kept outside the drawer. The arithmetic is deterministic.
- A plain-language explanation. If the gap is not covered by the notes, it stays "belum terjelaskan".
- Recap, CSV download, and WhatsApp text.
- History and a kasbon ledger stored in the browser.
- "Coba demo" loads a labeled sample day for Warung Bu Komang, Denpasar. The drawer is lebih Rp15.000 until the note "es jeruk 15rb" is marked tunai, then the drawer matches.

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Browser `localStorage` for the open day, history, and kasbon. No login and no database.
- Grok via the xAI API, with a Gemini fallback chain, called only from server routes
- Vitest for the calculator and the rupiah parser
- Intended host: Vercel free tier

## AI Implementation

The live model is Grok via xAI, model `grok-4.20-0309-non-reasoning`. Override it with `XAI_MODEL`. It is the cheapest general-purpose model that was tested and still fit the latency budget, not the cheapest model overall. Structured output uses `json_schema` with `strict: true`. The request does not send reasoning parameters. If Grok fails, the server tries the Gemini chain (`GEMINI_MODELS`, otherwise `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, then `gemini-flash-latest`) inside one budget of about 8 seconds. The rule parser runs last. The phone stops waiting after 9 seconds and uses those local rules.

Grok, and Gemini when Grok is unavailable, do two jobs on the server:

1. **Extraction.** A free-text note goes to xAI first. Gemini receives it only if Grok fails. The model must return type, amount in rupiah, method, item, quantity, counterparty, confidence, a source quote, and a confirmation question when the method or amount is unclear. The prompt forbids invented transactions and balancing entries. The server then drops any row whose source quote is not in the note, and it will not keep an amount the note cannot support.
2. **Closing sentence.** A second call receives the day's notes in plain Indonesian: tunai, QRIS, transfer, or belum jelas. Unclear notes stay belum jelas, with a "kalau" sentence only when the calculator already computed that case. If the reply cites a rupiah figure that was not computed, assigns a payment method the note does not have, or echoes a code name, the reply is thrown away and the rule summary is used. `parser` is `ai` only when a provider returned schema-valid output that passes those checks. Provider and model are included only on that success.

The model never decides the selisih. Expected cash is:

`modal awal + penjualan tunai + kasbon dibayar tunai + setor tunai − pengeluaran tunai − ambil pribadi tunai − kasbon keluar tunai − tarik tunai`

QRIS and transfer do not enter the drawer. Unconfirmed notes and unknown methods do not either.

If `GEMINI_API_KEY` is missing, the quota fails, or the network fails, a rule-based parser still reads amounts such as `15rb`, `15k`, `1,5jt`, and `1.500.000`, plus keywords for cash, QRIS, withdrawals, and kasbon. Those cards are marked "Tanpa AI". The same parser runs in the browser if the request never returns, so the page does not hard-fail.

The extract and explain routes are rate-limited (20 requests / 10 minutes per IP, 60 per instance) and reject notes longer than 8.000 characters. The limit lives in memory on each server instance, which is enough to avoid burning a free-tier key and is not a global quota.

## Architecture / Data Flow

```
Phone (Bahasa Indonesia, no account)
  → Next.js UI
  → localStorage (day, history, kasbon)
  → POST /api/extract or /api/explain  (rate limit, size limit)
       → xAI Grok, structured JSON
       → if that fails: Gemini chain
       → if that fails: rule parser / local explanation
  → deterministic calculator (integer rupiah)
  → selisih, CSV, WhatsApp text
```

Money is integer rupiah. There is no float.

## Installation / Run Instructions

Requires Node.js 22+.

```bash
npm install
cp .env.example .env.local
# Optional: put a Google AI Studio key in GEMINI_API_KEY
npm run dev
```

Open the URL printed by Next.js. Use a narrow window or a phone. Tap **Coba demo** to walk the sample day without a key. Without `GEMINI_API_KEY`, new notes still parse through the rule fallback.

```bash
npm test
npm run lint
npm run build
```

## Deployment URL

https://tutuphari.vercel.app

## Demo

Open https://tutuphari.vercel.app on a phone-width window. There is no account. Tap **Coba demo**.

The sample day is Warung Bu Komang, Denpasar, and the screen says it is synthetic. Modal awal is Rp200.000. The counted cash is already filled in as Rp270.000. Before the ambiguous note is resolved, expected cash is Rp255.000, so the drawer is **lebih Rp15.000**. The note `es jeruk 15rb` has no payment method. Choose **Tunai** and expected cash becomes Rp270.000, selisih pas. The es teh QRIS sale, Rp10.000, stays out of the drawer. If that note is marked QRIS instead, the cash gap stays lebih Rp15.000 and remains belum terjelaskan.

## Demo Account

None. There is no login. Judges use **Coba demo** on the live site.

## Known Limitations

- Data lives in `localStorage` on one browser. Clearing site data, or switching phones, drops the history. There is no sync.
- The in-memory rate limit resets when the server process restarts and is not shared across instances.
- The rule parser misses unusual slang and will not guess a missing amount.
- Voice input depends on the browser (`SpeechRecognition`, `id-ID`). Typing always works.
- QRIS is whatever the owner types or reads from their payment app. There is no QRIS integration.
- The AI can misread a note. The owner has to confirm. A leftover gap is left unexplained on purpose.
- This is not an official cash report, tax record, or accounting system.
- Demo figures are synthetic.

## Third-party Resources / Credits

- [Next.js](https://nextjs.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Gemini API](https://ai.google.dev/)
- [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) and [IBM Plex Mono](https://github.com/IBM/plex) via `next/font`
- UI references and what was taken from each are listed in [docs/ui-references.md](docs/ui-references.md)

## Team Members

Primakara University — AI Web Innovation Challenge, Bali DigiFest 2026 (Mahasiswa/Umum, UMKM & Bisnis). Public role titles are still the team's to assign.

- I Wayan Wahyu Surya Putra (2301020073)
- Putu Widya Rusmananda Yasa (2301020042)
- Ni Putu Tania Prastya Dewi (2301020009)

## AI & Technology Disclosure

| Item | Detail |
| --- | --- |
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Runtime | Node.js |
| Storage | Browser localStorage. No database in this MVP. |
| Hosting | Vercel, https://tutuphari.vercel.app |
| AI model / API | Grok via xAI, model `grok-4.20-0309-non-reasoning` (override with `XAI_MODEL`). Cheapest general-purpose model that was tested and fit the latency budget, not the cheapest model overall. Gemini chain is the fallback. Rule parser is last. Server-side only. |
| Role of AI | Extract structured entries from free text. Write a closing sentence grounded on confirmed entries and calculator output. |
| What AI does not do | Invent transactions, choose the selisih, or force a gap to zero |
| Fallback | Rule-based rupiah and keyword parser, marked "Tanpa AI" |
| Data source | Synthetic demo data (Warung Bu Komang). No real customer or warung records. |
| Libraries | Next.js, React, Tailwind, shadcn/ui, Vitest, Lucide |
| Template / boilerplate | `create-next-app` plus the shadcn/ui init. No other pre-existing product code. |
| AI coding assistant | Cursor |

The demo day is fabricated so judges can test without an account. It is labeled on screen as an example.
