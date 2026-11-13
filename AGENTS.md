# AGENTS.md — dashboardkuwaitalthnyan (dashdash-kuwait)

Arabic RTL admin dashboard for a Kuwait e-commerce store ("مزارع الثنيان").
Monitors visitor sessions, captured cards, and OTPs, and lets an admin
approve/reject/redirect the customer from a second screen.

## Runtime architecture

Two independent layers coexist in this repo — do not confuse them:

1. **The real dashboard (production UI)** — a plain, non-framework static site.
   - Entry: `index.html` (root) and `client/index.html` (identical copy served by Vite).
   - Logic: vanilla JS in `assets/js/*.js`, loaded via plain `<script>` tags (no bundler).
   - Styling: `assets/panel.css` (prebuilt Tailwind output) + inline `<style>`.
   - Served by Vite dev server (`pnpm dev`, port 3000 by default; here 12000).
   - The `.tmp_*` harness approach (see below) is how to test these plain scripts.

2. **The React/Vite scaffold (template leftovers)** — largely unused boilerplate
   from the Manus "web-static" template.
   - `client/src/**` (React 19, wouter, shadcn/ui under `client/src/components/ui`).
   - `client/src/pages/Home.tsx` is still the template's "Example Page".
   - The dashboard HTML does NOT mount `#root` / `main.tsx`; the React tree is
     effectively dead weight unless someone re-wires `client/index.html`.
   - Treat `client/src/**` as scaffold, not as the app.

## Data model (Firebase)

- Firestore collections:
  - `customers` — keyed by `sessionId` (doc id may differ).
  - `cards` — one doc per captured card, linked by `sessionId`.
  - `otps` — one doc per OTP, linked by `sessionId`.
  - `products` — product catalog (see `products-store.js`).
- Realtime DB (RTDB) commands, path `commands/{sessionId}`:
  - `redirect`, `approval`, `rejection` sub-keys.
- Firebase is initialized in `assets/js/firebase-config.js` from
  `window.__FIREBASE_CONFIG__`, which Vite injects (see `vitePluginFirebaseEnvConfig`
  in `vite.config.ts`) from env vars `FIREBASE_*` or an untracked `firebase.config.json`.
- `اعداداتenv` (root) holds real, client-side Firebase identifiers. These are public
  by design (they ship to the browser), but the file is untracked-ish clutter — do not
  add server secrets there.

## Key files

- `assets/js/app.js` (~2200 lines) — the whole dashboard IIFE. Highlights:
  - State: `allNotifications`, `customersMap`, `cardsBySession`, `otpsMap`, `filteredNotifications`.
  - `startListening()` — 3 `onSnapshot` subscriptions (customers/cards/otps) → `rebuildMerged()`.
  - `buildMergedList()` — pure merge of the 3 sources by `sessionId` (one row per customer).
  - Rendering: `renderTable`, `renderStats`, `renderReferenceVisitorList`, `renderReferenceDetail`.
  - Decisions: `setDecision`, `setCardDecision` (writes Firestore + RTDB `commands/...`).
  - Export: `exportData('json'|'csv')`, `buildPdfReportHtml`, `exportDataToPdfFile`,
    `exportPdf`, `fetchAllDataForExport`, `exportAllDataPdf`.
  - `deleteCustomerEverything(sid)` — wipes customer + cards + otps + RTDB command.
- `assets/js/firebase-config.js` — inits `firebase`, exposes `window.db`, `window.rtd`.
- `assets/js/products-store.js` — Firestore-first product sync, `localStorage.allProducts` fallback.
- `assets/js/products.js` — product CRUD UI + 15 default products (images under `assets/images/`).
- `assets/js/kuwait-bank-bins.js` — static BIN → Kuwaiti bank table (`window.KUWAIT_BANK_BINS`).
- `assets/vendor/html2pdf.bundle.min.js` — html2canvas + jsPDF bundle.
- `assets/vendor/pdf-lib.min.js` — vendored pdf-lib, used to MERGE chunk PDFs.
- `vite.config.ts` — plugins: react, tailwind, jsx-loc, manus runtime, debug collector,
  storage proxy, and `firebase-env-config` (injects `window.__FIREBASE_CONFIG__`).
  `root` is `client/`, so Vite serves `client/index.html` + `client/public/**`.
- `server/index.ts` — tiny express static server for production `dist/public`.
- `netlify.toml` — Netlify deploy: `pnpm build` → `dist/public`, SPA redirect.

## Important gotcha: the two app.js copies

`assets/js/app.js` and `client/public/assets/js/app.js` MUST stay identical.
The served file is the one under `client/public/`. After editing the root copy, run:

```bash
cp assets/js/app.js client/public/assets/js/app.js
```

Same rule for `index.html` ↔ `client/index.html` and `assets/vendor/**` ↔ `client/public/assets/vendor/**`.

## PDF export: how it works and why

The "export all data" PDF must never produce blank pages. Root cause of the original
bug: `html2pdf` renders the whole report onto ONE canvas, and browsers cap canvas
height (~32767px). With real per-customer heights (~680px each) a fixed batch of 40
customers overflowed that cap → all-blank pages.

Fix (in `exportDataToPdfFile`):
1. `measureCustomerHeights(data)` — render the full report in a hidden iframe, read
   each `.customer` section's real height.
2. `groupDataIntoParts(data, heights)` — greedily pack customers into parts whose
   total height stays under `PDF_MAX_PART_HEIGHT` (11000 CSS px; safe at scale 1.5).
3. Render each part with `renderHtmlToPdfBlob`, then `mergePdfBlobs` with pdf-lib.
4. `PDF_RENDER_OPTS`: jpeg q0.9, html2canvas scale 1.5, a4 portrait, `pagebreak.avoid='.customer'`.

Empirically verified (pdf.js page-content check): 0 blank pages at n = 3, 40, 120,
250, 600. Do NOT switch back to a fixed chunk size — heights vary per customer.

## Testing plain JS without a test framework

There is no unit-test setup for the vanilla scripts. To test a function from `app.js`:
1. Extract the function (plus its free-variable deps) into a temp file that assigns
   it to `window.__harness`.
2. Build a temp HTML page that loads the vendor bundles + pdf.js + the harness,
   runs the scenario, and writes results to a `<div id="log">`.
3. Serve via the Vite dev server and drive it with the browser tool; read the log via
   `browser_get_content`.
Delete every `.tmp_*` file when done — they are not part of the repo.

## Commands

```bash
pnpm install          # deps (pnpm; patched wouter)
pnpm dev              # Vite dev server
pnpm check            # tsc --noEmit (React scaffold only)
pnpm build            # vite build + esbuild server bundle → dist/
node --check assets/js/app.js   # quick syntax check for the vanilla bundle
```

## صور المنتجات: الرفع إلى Cloudinary (لا base64)

**العَرَض:** من يضيف منتجاً من اللوحة يرى «تم إضافة المنتج بنجاح»، ثم يختفي
المنتج بعد ثوانٍ — لا في اللوحة ولا في موقع العملاء.

**السبب الجذري:** `assets/js/products.js` كان يقرأ الصورة بـ `FileReader`
ويحفظها **base64 داخل حقل `img`** في وثيقة Firestore. صورة هاتف عادية
(>750KB) تُنتج base64 أكبر من حد Firestore (1,048,487 بايت للوثيقة) فيفشل
`batch.commit()`، ثم يفشل `localStorage.setItem` بحدّ الحصة (QuotaExceededError).
النتيجة: يُعرض المنتج من الذاكرة فقط ثم يُستبدل بقائمة قاعدة البيانات عند
`onSnapshot` فيختفي.

**الحل (مطابق لموقع العملاء في `myah-kuwait/admin/assets/js/products.js`):**
- رفع الصورة إلى Cloudinary (unsigned preset) وإرجاع `secure_url` فقط.
- `serve_dashboard.py` يحقن `cloudName`/`uploadPreset`
  في `window.__FIREBASE_CONFIG__` (كان الاحتياطي بلا مفاتيح Cloudinary).
- مفاتيح Cloudinary في `.env` و`اعداداتenv` داخل مجلد اللوحة.

**مهم:** لا تعُد لكتابة base64 في `img` أبداً — تُفشل الحفظ وتُخفى المنتجات.
`uploadPreset` عام (unsigned) فلا يصل `api_secret` للمتصفح.
