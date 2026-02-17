# Cubis Whiteboard

A collaborative whiteboard application built with Excalidraw, Next.js 16+, and real-time collaboration.

## Tech Stack

- **Frontend**: Next.js 16+ (App Router), React 19, ShadCN UI, Excalidraw
- **Auth**: better-auth with email/password + Zitadel OpenID (via generic OAuth plugin)
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Socket.IO for live collaboration
- **Storage**: Local filesystem or S3-compatible (Cloudflare R2)
- **Package Manager**: Bun

## Features

- Persistent whiteboard storage with auto-save
- Real-time collaboration with live cursors
- Search whiteboards by title
- Collections (drag & drop whiteboards into collections)
- Share whiteboards with collaborators (viewer/editor roles)
- Public/private whiteboard toggle
- File uploads (local or S3/R2)
- Email/password + Zitadel SSO authentication

## Getting Started

### Prerequisites

- Bun (v1.0+)
- PostgreSQL database
- (Optional) Zitadel instance for SSO
- (Optional) S3-compatible storage (e.g., Cloudflare R2)

### Setup

```bash
# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database URL, auth secrets, etc.

# Push database schema
bun run db:push

# Start development server (with Socket.IO)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret for session signing |
| `BETTER_AUTH_URL` | App base URL |
| `ZITADEL_CLIENT_ID` | Zitadel OAuth client ID (optional) |
| `ZITADEL_CLIENT_SECRET` | Zitadel OAuth client secret (optional) |
| `ZITADEL_ISSUER` | Zitadel issuer URL (optional) |
| `STORAGE_PROVIDER` | `local` or `s3` |
| `LOCAL_UPLOAD_DIR` | Path for local uploads (default: `./uploads`) |
| `S3_ENDPOINT` | S3/R2 endpoint URL |
| `S3_REGION` | S3 region (use `auto` for R2) |
| `S3_BUCKET` | S3 bucket name |
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |

### Scripts

```bash
bun run dev          # Start dev server with Socket.IO
bun run dev:next     # Start Next.js dev only (no Socket.IO)
bun run build        # Production build
bun run start        # Production server
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run migrations
bun run db:push      # Push schema directly
bun run db:studio    # Open Drizzle Studio
```

## Architecture

```
src/
├── app/
│   ├── (auth)/          # Login & signup pages
│   ├── (dashboard)/     # Dashboard, whiteboard editor, collections
│   └── api/             # REST API routes
│       ├── auth/        # better-auth handler
│       ├── whiteboards/ # CRUD + collaboration
│       ├── collections/ # Collection management
│       ├── upload/      # File upload & serving
│       └── socketio/    # Socket.IO placeholder
├── components/
│   ├── ui/              # ShadCN components
│   ├── whiteboard/      # Excalidraw editor, share dialog
│   └── dashboard/       # Dashboard view
├── hooks/               # useRealtime hook
└── lib/
    ├── auth/            # better-auth server & client config
    ├── db/              # Drizzle schema & connection
    ├── realtime/        # Socket.IO server
    └── storage/         # File storage (local + S3)
```
