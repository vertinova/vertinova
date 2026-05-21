# External Finance API

Dokumen ini untuk web atau sistem eksternal yang ingin mengambil data keuangan
dari Simpaskor. Semua endpoint bersifat server-to-server dan berada di:

```text
https://simpaskor.id/api/external
```

Ganti `https://simpaskor.id` dengan domain backend produksi Simpaskor.

## Autentikasi

Kirim API key lewat salah satu header berikut:

```http
X-API-Key: <EXTERNAL_FINANCE_API_KEY>
```

atau:

```http
Authorization: Bearer <EXTERNAL_FINANCE_API_KEY>
```

Jangan panggil endpoint ini langsung dari browser frontend, karena API key akan
terlihat oleh user. Panggil dari backend web eksternal.

## Ringkasan Endpoint

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/external/admin-fees` | Mengambil admin fee dari tiket, voting, dan pendaftaran. |
| `GET /api/external/platform-revenue` | Mengambil pendapatan Simpaskor dari bagi hasil tiket/voting dan pembayaran paket event. |
| `GET /api/external/revenue-share-balances` | Mengambil saldo bagi hasil panitia dari tiket dan voting secara lifetime. |
| `GET /api/external/summary` | Mengambil total saldo Simpaskor dalam satu response. |

## Endpoint Utama Untuk Saldo Bagi Hasil

Gunakan endpoint ini jika web eksternal butuh saldo bagi hasil dari vote dan tiket:

```http
GET /api/external/revenue-share-balances
```

Saldo ini bersifat lifetime. Artinya, sistem menghitung seluruh transaksi tiket
dan voting yang sudah `PAID`, lalu mengurangi seluruh dana yang sudah atau sedang
diajukan pencairannya.

Rumus utama:

```text
activeBalance = panitiaShare lifetime - totalWithdrawn - totalPending
```

Field penting:

| Field | Arti |
| --- | --- |
| `grossRevenue` | Total bruto tiket + voting sebelum dibagi hasil. |
| `ticketGrossRevenue` | Total bruto dari tiket saja. |
| `votingGrossRevenue` | Total bruto dari voting saja. |
| `platformShare` | Bagian Simpaskor dari tiket + voting. |
| `panitiaShare` | Bagian panitia dari tiket + voting. |
| `ticketRevenue` | Bagian panitia dari tiket. |
| `votingRevenue` | Bagian panitia dari voting. |
| `totalWithdrawn` | Saldo panitia yang sudah disetujui/ditransfer. |
| `totalPending` | Saldo panitia yang sedang diajukan dan menunggu proses. |
| `activeBalance` | Saldo aktif yang masih bisa ditarik. |

### Query Parameter

| Parameter | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `eventId` | string | Tidak | Isi jika hanya ingin mengambil saldo satu event. |
| `includeDetails` | boolean | Tidak | Isi `true` jika butuh detail per transaksi. Default `false`. |

### Contoh Request

```bash
curl -X GET \
  "https://simpaskor.id/api/external/revenue-share-balances?includeDetails=true" \
  -H "X-API-Key: <EXTERNAL_FINANCE_API_KEY>"
```

Untuk satu event:

```bash
curl -X GET \
  "https://simpaskor.id/api/external/revenue-share-balances?eventId=<EVENT_ID>" \
  -H "X-API-Key: <EXTERNAL_FINANCE_API_KEY>"
```

### Contoh Response

```json
{
  "currency": "IDR",
  "filters": {
    "eventId": null,
    "scope": "lifetime"
  },
  "summary": {
    "grossRevenue": 12000000,
    "ticketGrossRevenue": 8000000,
    "votingGrossRevenue": 4000000,
    "platformShare": 2400000,
    "panitiaShare": 9600000,
    "ticketRevenue": 6400000,
    "votingRevenue": 3200000,
    "totalWithdrawn": 5000000,
    "totalPending": 1000000,
    "activeBalance": 3600000,
    "lockedPlatformShare": 1250000,
    "activePlatformShare": 1150000
  },
  "counts": {
    "events": 1,
    "revenueShares": 25
  },
  "events": [
    {
      "event": {
        "id": "event_id",
        "title": "Festival Paskibra Nasional",
        "slug": "festival-paskibra-nasional",
        "startDate": "2026-05-01T00:00:00.000Z",
        "packageTier": "TICKETING_VOTING",
        "configuredPlatformSharePercent": 20,
        "platformSharePercent": 20,
        "panitiaSharePercent": 80
      },
      "balance": {
        "grossRevenue": 12000000,
        "ticketGrossRevenue": 8000000,
        "votingGrossRevenue": 4000000,
        "platformShare": 2400000,
        "panitiaShare": 9600000,
        "ticketRevenue": 6400000,
        "votingRevenue": 3200000,
        "totalWithdrawn": 5000000,
        "totalPending": 1000000,
        "activeBalance": 3600000,
        "lockedPlatformShare": 1250000,
        "activePlatformShare": 1150000
      }
    }
  ],
  "details": [
    {
      "id": "revenue_share_id",
      "transactionId": "transaction_id",
      "eventId": "event_id",
      "eventTitle": "Festival Paskibra Nasional",
      "eventSlug": "festival-paskibra-nasional",
      "sourceType": "TICKET",
      "sourceCode": "TICKET-ABC123",
      "grossAmount": 100000,
      "platformAmount": 20000,
      "panitiaAmount": 80000,
      "withdrawnPanitiaAmount": 0,
      "activePanitiaAmount": 80000,
      "status": "AVAILABLE",
      "paidAt": "2026-05-01T10:30:00.000Z"
    }
  ]
}
```

## Admin Fee

```http
GET /api/external/admin-fees
```

Endpoint ini mengambil admin fee layanan. Admin fee berbeda dari bagi hasil.

Rumus saat ini:

| Sumber | Rumus |
| --- | --- |
| Tiket | Rp 2.000 x jumlah tiket |
| Voting | Rp 500 x jumlah vote, maksimal Rp 10.000 per transaksi |
| Pendaftaran | Rp 5.000 per transaksi |

Query parameter:

| Parameter | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `from` | ISO date | Tidak | Filter mulai tanggal bayar. |
| `to` | ISO date | Tidak | Filter sampai tanggal bayar. |
| `eventId` | string | Tidak | Filter satu event. |
| `includeDetails` | boolean | Tidak | Isi `true` untuk detail transaksi. |

Contoh:

```bash
curl -X GET \
  "https://simpaskor.id/api/external/admin-fees?from=2026-01-01&to=2026-12-31&includeDetails=true" \
  -H "X-API-Key: <EXTERNAL_FINANCE_API_KEY>"
```

Contoh response ringkas:

```json
{
  "currency": "IDR",
  "filters": {
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-12-31T00:00:00.000Z",
    "eventId": null
  },
  "summary": {
    "totalAdminFee": 850000,
    "ticketAdminFee": 500000,
    "votingAdminFee": 250000,
    "registrationAdminFee": 100000,
    "qrisFee": 0
  },
  "counts": {
    "tickets": 250,
    "voting": 80,
    "registrations": 20
  }
}
```

## Pendapatan Platform

```http
GET /api/external/platform-revenue
```

Endpoint ini mengambil pendapatan Simpaskor dari:

- Bagian platform dari transaksi tiket.
- Bagian platform dari transaksi voting.
- Pembayaran paket event seperti `BRONZE` dan `GOLD`.

Query parameter sama seperti `/admin-fees`.

Contoh:

```bash
curl -X GET \
  "https://simpaskor.id/api/external/platform-revenue?includeDetails=true" \
  -H "X-API-Key: <EXTERNAL_FINANCE_API_KEY>"
```

Contoh response ringkas:

```json
{
  "currency": "IDR",
  "summary": {
    "totalPlatformRevenue": 4400000,
    "totalPlatformShare": 2400000,
    "platformShareFromTickets": 1600000,
    "platformShareFromVoting": 800000,
    "totalPackagePayments": 2000000,
    "packageTotalsByTier": {
      "BRONZE": 500000,
      "GOLD": 1500000
    },
    "grossRevenue": {
      "tickets": 8000000,
      "voting": 4000000,
      "total": 12000000
    },
    "panitiaShare": {
      "tickets": 6400000,
      "voting": 3200000,
      "total": 9600000
    }
  }
}
```

## Summary Simpaskor

```http
GET /api/external/summary
```

Endpoint ini untuk dashboard yang hanya butuh total pendapatan Simpaskor.

`totalSimpaskorBalance` dihitung dari:

```text
totalSimpaskorBalance = adminFee.total + platformShare.total + packagePayments.total
```

Contoh:

```bash
curl -X GET \
  "https://simpaskor.id/api/external/summary" \
  -H "X-API-Key: <EXTERNAL_FINANCE_API_KEY>"
```

Contoh response:

```json
{
  "currency": "IDR",
  "summary": {
    "totalSimpaskorBalance": 5250000,
    "adminFee": {
      "total": 850000,
      "ticket": 500000,
      "voting": 250000,
      "registration": 100000
    },
    "platformShare": {
      "total": 2400000,
      "fromTickets": 1600000,
      "fromVoting": 800000,
      "ticketGrossRevenue": 8000000,
      "votingGrossRevenue": 4000000
    },
    "packagePayments": {
      "total": 2000000,
      "byTier": {
        "BRONZE": 500000,
        "GOLD": 1500000
      }
    }
  }
}
```

## Contoh Integrasi Node.js

```js
const BASE_URL = "https://simpaskor.id/api/external";
const API_KEY = process.env.SIMPASKOR_EXTERNAL_FINANCE_API_KEY;

async function getRevenueShareBalances(eventId) {
  const url = new URL(`${BASE_URL}/revenue-share-balances`);
  if (eventId) url.searchParams.set("eventId", eventId);

  const response = await fetch(url, {
    headers: {
      "X-API-Key": API_KEY
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Simpaskor API error ${response.status}: ${error}`);
  }

  return response.json();
}

getRevenueShareBalances()
  .then((data) => {
    console.log("Saldo aktif semua event:", data.summary.activeBalance);
  })
  .catch(console.error);
```

## Catatan Data

- Semua nominal memakai mata uang IDR.
- Semua nominal dikirim sebagai angka, bukan string format rupiah.
- Semua transaksi yang dihitung harus berstatus `PAID`.
- Endpoint saldo bagi hasil bersifat lifetime dan tidak menerima filter tanggal.
- Jika `includeDetails=false`, response lebih ringan dan cocok untuk dashboard.
- Jika butuh audit transaksi, gunakan `includeDetails=true`.

## Status Error

| Status | Arti |
| --- | --- |
| 200 | Berhasil. |
| 400 | Query tanggal tidak valid. |
| 401 | API key salah atau tidak dikirim. |
| 404 | Event tidak ditemukan untuk `eventId` tertentu. |
| 500 | Error server. Cek log backend Simpaskor. |

## Checklist Untuk Web Eksternal

1. Simpan API key di environment backend web eksternal.
2. Jangan simpan API key di frontend atau localStorage.
3. Ambil saldo bagi hasil memakai `/revenue-share-balances`.
4. Ambil total pendapatan Simpaskor memakai `/summary`.
5. Gunakan `eventId` jika butuh data per event.
6. Gunakan `includeDetails=true` hanya untuk audit atau halaman detail.
