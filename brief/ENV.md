# ENV.md — Environment Variables

```
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://vereport.domain.com

# Object Storage (RustFS - S3 compatible)
S3_ENDPOINT=https://s3.domain.com
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=vereport-storage
S3_REGION=us-east-1

# Telegram Bot (khusus notifikasi ke Developer)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID_DEV=

# App
APP_URL=https://vereport.domain.com
NODE_ENV=production
```

## Aturan

- Semua variabel wajib diisi di `.env`, tidak boleh hardcode di kode
- `.env` wajib gitignored, tidak boleh masuk repository
- Kredensial S3/RustFS dan Telegram Bot Token termasuk data sensitif — jangan pernah di-log atau ditampilkan di UI
