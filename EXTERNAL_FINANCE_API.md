# External Finance API — Panduan Pengelolaan

Dokumen ini menjelaskan cara kerja, cara mengamankan, dan cara mengoperasikan
**External Finance API** Simpaskor (`/api/external/*`). API ini dipakai sistem
finansial eksternal (Vertinova) untuk menarik data pemasukan platform dalam
mode pull, sebagai pelengkap webhook real-time yang Simpaskor kirim per transaksi.

---

## 1. Ringkasan Endpoint

Semua endpoint berada di prefix `/api/external` dan **wajib** menyertakan API key.

| Endpoint | Tujuan | Sumber Data |
|---|---|---|
| `GET /api/external/admin-fees` | Pemasukan admin fee (biaya layanan per transaksi) | `admin_fee_transactions` ledger (auto-reconcile) |
| `GET /api/external/platform-revenue` | Bagi hasil platform + pembayaran paket event | `revenue_shares` + `event_payments` |
| `GET /api/external/summary` | Ringkasan total saldo Simpaskor dari semua sumber | Gabungan ketiganya |

### 1.1 Apa yang termasuk "Saldo Simpaskor"?

Saldo Simpaskor terdiri dari tiga komponen:

1. **Admin fee** — biaya layanan flat yang dibebankan ke pembeli, di luar harga
   barang. Rumus saat ini:
   - Tiket: `Rp 2.000 × jumlah tiket`
   - Voting: `min(Rp 500 × jumlah vote, Rp 10.000)`
   - Registrasi event: `Rp 5.000` per pembayaran
2. **Bagi hasil platform (`platformShare`)** — persentase dari nilai bruto
   ticketing/voting yang menjadi hak Simpaskor, berdasarkan tier paket dan
   `platformSharePercent` per event:
   - Default tier tunggal (TICKETING / VOTING): 15% platform / 85% panitia
   - Default bundle (TICKETING_VOTING): 25% platform / 75% panitia
   - BRONZE / GOLD: mengikuti `platformSharePercent` yang ditentukan admin
   - Nilai akhir di-clamp `0–100%`
3. **Pembayaran paket (`packagePayments`)** — pembayaran upfront tier berbayar:
   - `BRONZE`: Rp 500.000
   - `GOLD`: Rp 1.500.000
   - `IKLAN` / `TICKETING` / `VOTING` / `TICKETING_VOTING`: 0 (bagi hasil saja)

---

## 2. Autentikasi

API key dikirim sebagai salah satu dari:

```http
X-API-Key: <key>
# atau
Authorization: Bearer <key>
```

Server membandingkan key dengan `crypto.timingSafeEqual` agar aman dari
timing attack. Key salah → `401 { error: "Access denied" }`.

### 2.1 Mengatur API key

API key dibaca dari environment variable `EXTERNAL_FINANCE_API_KEY`.
Selama variabel tidak diset, server jatuh ke key default lama agar deployment
existing tidak putus. **Wajib** rotasi ke env variable di production.

`.env` (backend):

```dotenv
# API key untuk endpoint /api/external/*
EXTERNAL_FINANCE_API_KEY="ganti-dengan-key-acak-min-32-karakter"

# (opsional) URL webhook yang Simpaskor push ke Vertinova
VERTINOVA_FINANCE_WEBHOOK_URL="https://vertinova.id/api/finance/webhooks/simpaskor"
# Bila tidak diset, Vertinova webhook pakai EXTERNAL_FINANCE_API_KEY
VERTINOVA_FINANCE_API_KEY="ganti-dengan-key-acak-min-32-karakter"
```

Cara generate key aman:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.2 Rotasi key

1. Generate key baru.
2. Update `EXTERNAL_FINANCE_API_KEY` di `.env` produksi.
3. Kirim key baru ke Vertinova melalui saluran aman (1Password / Bitwarden).
4. Restart backend: `pm2 restart simpaskor-api` atau `docker compose restart backend`.
5. Verifikasi Vertinova sudah pakai key baru (cek response 200 di log akses).
6. Setelah verifikasi, anggap key lama hangus.

> Catatan: kalau partner butuh masa transisi, tambahkan logika multi-key
> sementara dengan memperbolehkan dua key paralel. Saat ini server hanya
> menerima satu key, sehingga rotasi harus dikoordinasikan singkat (< 5 menit).

---

## 3. Endpoint Detail

### 3.1 `GET /api/external/admin-fees`

Pemasukan admin fee Simpaskor.

**Query parameters (semua opsional):**

| Param | Tipe | Keterangan |
|---|---|---|
| `from` | ISO date | Filter `paid_at >= from` |
| `to` | ISO date | Filter `paid_at <= to` |
| `eventId` | string | Hanya event tertentu |
| `includeDetails` | `true`/`false` | Sertakan baris transaksi |

**Response:**

```json
{
  "currency": "IDR",
  "filters": { "from": null, "to": null, "eventId": null },
  "summary": {
    "totalAdminFee": 1530000,
    "ticketAdminFee": 800000,
    "votingAdminFee": 250000,
    "registrationAdminFee": 480000,
    "qrisFee": 0
  },
  "counts": { "tickets": 12, "voting": 9, "registrations": 96 },
  "details": { "tickets": [...], "voting": [...], "registrations": [...] },
  "data": [ { "source": "ticket", "id": "...", "adminFee": 4000, ... } ]
}
```

**Sinkronisasi lifetime:** sebelum membaca, server otomatis menjalankan
`reconcileAdminFeeLedger()` untuk meng-insert transaksi `PAID` yang belum
tercatat di `admin_fee_transactions`. Artinya angka yang dikembalikan selalu
mencakup seluruh transaksi historis tanpa perlu maintenance manual.

### 3.2 `GET /api/external/platform-revenue`

Bagi hasil Simpaskor dari ticketing/voting + pembayaran paket event.

**Query parameters:** sama seperti `/admin-fees`.

**Response:**

```json
{
  "currency": "IDR",
  "summary": {
    "totalPlatformRevenue": 7500000,
    "totalPlatformShare": 5500000,
    "platformShareFromTickets": 3200000,
    "platformShareFromVoting": 2300000,
    "totalPackagePayments": 2000000,
    "packageTotalsByTier": { "BRONZE": 500000, "GOLD": 1500000 },
    "grossRevenue": { "tickets": 20000000, "voting": 15000000, "total": 35000000 },
    "panitiaShare": { "tickets": 16800000, "voting": 12700000, "total": 29500000 }
  },
  "counts": {
    "revenueShares": 24,
    "ticketShares": 12,
    "votingShares": 12,
    "packagePayments": 3
  }
}
```

**Catatan:**

- `platformShare` dihitung di sisi panitia paid (Midtrans webhook PAID),
  sehingga sudah memperhitungkan refund yang men-status-kan transaksi `CANCELLED`.
- `withdrawnPanitiaAmount` di detail merepresentasikan berapa banyak bagian
  panitia yang sudah dicairkan via disbursement — tidak berpengaruh pada hak
  Simpaskor (`platformAmount`).

### 3.3 `GET /api/external/summary`

Endpoint praktis untuk dashboard. Mengembalikan totalan semua komponen tanpa
detail baris transaksi.

**Query parameters:** sama seperti `/admin-fees`.

**Response:**

```json
{
  "currency": "IDR",
  "summary": {
    "totalSimpaskorBalance": 9030000,
    "adminFee": {
      "total": 1530000,
      "ticket": 800000,
      "voting": 250000,
      "registration": 480000
    },
    "platformShare": {
      "total": 5500000,
      "fromTickets": 3200000,
      "fromVoting": 2300000,
      "ticketGrossRevenue": 20000000,
      "votingGrossRevenue": 15000000
    },
    "packagePayments": {
      "total": 2000000,
      "byTier": { "BRONZE": 500000, "GOLD": 1500000 }
    }
  }
}
```

`totalSimpaskorBalance = adminFee.total + platformShare.total + packagePayments.total`.

---

## 4. Webhook Push (Simpaskor → Vertinova)

Di samping API pull, Simpaskor juga mendorong notifikasi real-time setiap kali
transaksi `PAID` masuk ke Vertinova. File: [vertinovaFinanceWebhook.ts](../backend/src/lib/vertinovaFinanceWebhook.ts).

- URL default: `https://vertinova.id/api/finance/webhooks/simpaskor`
  (override via `VERTINOVA_FINANCE_WEBHOOK_URL`).
- Header: `X-API-Key: <VERTINOVA_FINANCE_API_KEY>`.
- Payload: `{ orderId, amount, paidAt, description }`.
- Timeout 10 detik, dipanggil dari payment handler. **Tidak retry otomatis** —
  jika gagal, gunakan endpoint pull untuk rekonsiliasi.

---

## 5. Cara Konsumsi (cURL)

```bash
# Lifetime summary
curl -H "X-API-Key: $KEY" "https://api.simpaskor.id/api/external/summary"

# Bulan berjalan, dengan detail
curl -H "X-API-Key: $KEY" \
  "https://api.simpaskor.id/api/external/admin-fees?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z&includeDetails=true"

# Per event
curl -H "X-API-Key: $KEY" \
  "https://api.simpaskor.id/api/external/platform-revenue?eventId=<EVENT_ID>"
```

---

## 6. Operasi & Troubleshooting

### 6.1 Audit konsistensi data

Setiap kali `/admin-fees` atau `/summary` diakses, ledger di-rekonsiliasi.
Untuk audit ulang manual:

```ts
import { reconcileAdminFeeLedger } from "./lib/adminFeeLedger";
await reconcileAdminFeeLedger(); // returns { ticket, voting, registration } yang baru ter-insert
```

### 6.2 Memeriksa selisih

Jika total di Vertinova tidak cocok dengan total di Simpaskor:

1. Bandingkan `summary.totalSimpaskorBalance` dari `/summary` dengan total di
   Vertinova pada window waktu yang sama.
2. Bila admin fee yang berbeda, ambil `?includeDetails=true` di `/admin-fees`
   dan cari `midtransOrderId` yang hilang di sisi Vertinova.
3. Bila bagi hasil yang berbeda, ambil `?includeDetails=true` di
   `/platform-revenue` — fokus pada baris `status` `AVAILABLE` /
   `PARTIALLY_WITHDRAWN` / `WITHDRAWN` (semua dihitung; hanya `CANCELLED` yang
   diabaikan).

### 6.3 Status code

| Kode | Arti |
|---|---|
| 200 | OK |
| 400 | Format tanggal tidak valid (`from` / `to`) |
| 401 | API key salah atau tidak dikirim |
| 500 | Error server, periksa log `Error fetching ...` di backend |

### 6.4 Log akses

Akses ke `/api/external/*` muncul di log Express. Untuk audit, filter access
log berdasarkan path tersebut. Hindari menulis API key ke log.

### 6.5 Penambahan endpoint baru

Untuk menambah endpoint baru:

1. Tambahkan handler di [externalFinance.ts](../backend/src/routes/externalFinance.ts).
2. Pastikan endpoint memakai middleware `requireExternalFinanceApiKey`.
3. Update dokumen ini di section 1 (tabel) dan 3 (detail).
4. Beri tahu tim Vertinova lewat changelog terpisah.

---

## 7. Daftar Cek Sebelum Go-Live

- [ ] `EXTERNAL_FINANCE_API_KEY` diset di env produksi (bukan default fallback).
- [ ] Vertinova sudah menerima key produksi via saluran rahasia.
- [ ] `VERTINOVA_FINANCE_WEBHOOK_URL` & `VERTINOVA_FINANCE_API_KEY` sesuai env target.
- [ ] Tes `/api/external/summary` dengan key produksi → 200 + data wajar.
- [ ] `reconcileAdminFeeLedger()` dijalankan minimal sekali sebelum cutover
      (otomatis terjadi di request pertama, tapi bisa dipicu manual via script).
- [ ] Backup database terbaru tersedia bila perlu rollback ledger.
