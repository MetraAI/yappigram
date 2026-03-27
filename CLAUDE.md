# CLAUDE.md — YappiGram (Metra CRM)

Telegram CRM embedded in PostForge via iframe. This repo contains CRM backend + frontend source code.

## Repo & Branches

- **Repo**: `https://github.com/rtp-agency/yappigram.git`
- **Branch**: `main` (production)
- **PostForge repo**: `https://github.com/rtp-agency/PostForge.git` (branch: `dev0x`)

## Production Server

**Host**: `metra@144.31.234.105` (SSH key auth)

### CRITICAL: How CRM is deployed

CRM containers are NOT managed by this repo's docker-compose.yml. They are defined in **PostForge's** `metraAi/docker-compose.yml` under `profile: crm`, with build context `../yappigram/`.

```bash
# Deploy CRM (from server):
cd ~/yappigram && git pull origin main
cd ~/metraAi && docker compose --profile crm up -d --build crm-backend crm-frontend

# Deploy only backend:
cd ~/metraAi && docker compose --profile crm up -d --build crm-backend

# Deploy only frontend:
cd ~/metraAi && docker compose --profile crm up -d --build crm-frontend

# Force rebuild (no Docker cache):
cd ~/metraAi && docker compose --profile crm build --no-cache crm-frontend
docker compose --profile crm up -d crm-frontend

# View logs:
docker logs postforge-crm-backend --tail 50
docker logs postforge-crm-frontend --tail 20

# CRM database:
docker exec postforge-crm-db psql -U tgcrm -d tgcrm
```

### Container names
| Container | Port | Purpose |
|---|---|---|
| `postforge-crm-backend` | 8100 | CRM FastAPI backend |
| `postforge-crm-frontend` | 3100 | CRM Next.js frontend |
| `postforge-crm-db` | internal | PostgreSQL (tgcrm) |
| `postforge-crm-redis` | internal | Redis |

## Architecture

```
PostForge (metra-ai.org)
  └── CrmPage.tsx (iframe) → CRM Frontend (Next.js)
                                    ↕ REST + WebSocket
                              CRM Backend (FastAPI)
                                    ↕ Telethon (MTProto)
                              Telegram API
                                    ↕
                              PostgreSQL (contacts, messages, scheduled_messages, etc.)
```

## Backend

**Main file**: `backend/app.py` (~2800+ lines) — all endpoints + inline startup migrations.

### Key patterns
- **No Alembic** — migrations are inline SQL in `@app.on_event("startup")` with `IF NOT EXISTS`
- **Telethon** (not python-telegram-bot) for Telegram client operations
- **Async SQLAlchemy** with asyncpg
- `app.py` is very large — always read specific sections with `offset/limit`

### Key files
- `app.py` — All API endpoints, startup migrations, background tasks
- `telegram.py` — Telethon client management, message listeners (incoming/outgoing), send/forward/delete
- `models.py` — SQLAlchemy models
- `schemas.py` — Pydantic schemas
- `config.py` — Settings from env vars
- `crypto.py` — Fernet encryption for real names/usernames
- `ws.py` — WebSocket manager
- `bot.py` — Telegram bot for notifications

### Background tasks (run in asyncio)
- `_auto_sync_on_startup()` — sync TG dialogs for all connected accounts
- `_process_scheduled_messages()` — check and send due scheduled messages every 30s
- `_cleanup_disconnected_accounts()` — delete data for accounts disconnected > 30 days (daily)

### Key models
- **Contact** — TG chat entity (private/group/supergroup/channel), has alias, real_name_encrypted, tags, is_archived
- **Message** — individual message with direction, content, media, reply, forward, sticker support
- **ScheduledMessage** — pending/sent/cancelled, stores scheduled_at (UTC naive), timezone, content
- **TgAccount** — connected Telegram account, is_active, disconnected_at for soft-delete
- **Staff** — CRM user linked to PostForge org via SSO
- **Tag**, **MessageTemplate**, **PinnedChat**, **Broadcast**

### API highlights
- `POST /api/messages/{contact_id}/send` — send text message
- `POST /api/messages/{contact_id}/send-media` — upload and send file
- `POST /api/messages/{contact_id}/schedule` — create scheduled message
- `GET /api/scheduled` — list pending scheduled messages
- `DELETE /api/scheduled/{id}` — cancel scheduled message
- `GET /api/contacts?archived=false` — list contacts (archived param filters server-side)
- `GET /api/tg/status` — list active TG accounts (filters inactive, masks phone for operators)
- Operators see only assigned account tags/templates, masked phone numbers

## Frontend

**Framework**: Next.js 14 (App Router) + Tailwind CSS

### Key files
- `src/app/chats/page.tsx` — Main chat page (~2200+ lines), messages, context menu, input bar, media queue
- `src/components.tsx` — AppShell (sidebar + bottom nav), AuthGuard, Button, Input, Badge
- `src/lib.ts` — API client, types, WebSocket, auth helpers
- `src/app/settings/page.tsx` — Settings (TG accounts, tags, templates, timezone)
- `tailwind.config.ts` — Brand colors (brand/accent/surface), animations

### UI features
- **Context menu** on messages (right-click PC / long-press mobile): Reply, Copy, Translate, Edit, Forward, Delete
- **Media queue**: attach up to 5 files before sending, preview thumbnails
- **Scheduled messages**: date/time picker in user timezone, list/cancel pending
- **Voice player**: custom waveform player with seek
- **Translate**: inline button appears when typing real text (not just spaces/digits)
- **Bottom nav**: hidden when chat is open on mobile

### Colors
```
brand: #0ea5e9 (sky blue)
brand-light: #38bdf8
brand-dark: #0284c7
accent: #2dd4bf (teal)
surface: #0c1222 (dark bg)
surface-card: #111827
surface-hover: #1a2332
surface-border: #1e293b
```

## Language

All user-facing text is in Russian. Code comments in English. Commit messages in English.

## Common Issues

- **Telegram Mini App caching**: Android/iOS aggressively cache WebView. User must close and reopen mini-app to see updates.
- **iOS input zoom**: All inputs forced to `font-size: 16px !important` on mobile to prevent Safari zoom.
- **Message ordering**: Sort by `created_at` with fallback to `tg_message_id` for same-timestamp messages.
- **Document files**: Telethon downloads need extension extracted from `file_name` attribute or `mime_type`.
- **Delete contact**: Must cascade delete `broadcast_recipients` before deleting contact (FK constraint).
- **Scheduled messages**: Stored as naive UTC datetime in PostgreSQL. Use `_parse_schedule_dt()` to convert from user timezone.
- **Disconnect TG account**: Wrap `disconnect_account()` in try/except — session may be expired.
