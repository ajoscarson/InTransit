# Film Roll Tracker

A mobile-first PWA for tracking analog film rolls from shoot to scan.

## Stack

- **Client**: Vite + React + PWA (390px mobile-first)
- **Server**: Node.js + Express + PostgreSQL
- **Auth**: Supabase (JWT passed to Express API)
- **Payments**: Stripe (Solo $8/mo, Pro $15/mo)
- **Push**: Web Push API + VAPID keys
- **Database**: PostgreSQL (Railway or Render)

---

## Setup

### 1. Clone and install

```bash
npm run install:all
```

### 2. Database

Provision a PostgreSQL database on [Railway](https://railway.app) or [Render](https://render.com), then run the schema:

```bash
psql $DATABASE_URL -f server/schema.sql
```

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. From **Project Settings → API**, copy:
   - `SUPABASE_URL` (Project URL)
   - `VITE_SUPABASE_ANON_KEY` (anon/public key)
   - `SUPABASE_JWT_SECRET` (JWT Secret, under Settings → API → JWT Settings)

### 4. VAPID keys for push notifications

Generate once and store in both `.env` files:

```bash
npx web-push generate-vapid-keys
```

This outputs:
```
Public Key:  <VAPID_PUBLIC_KEY>   → also VITE_VAPID_PUBLIC_KEY
Private Key: <VAPID_PRIVATE_KEY>
```

Set `VAPID_EMAIL` to a `mailto:` address (e.g. `mailto:you@example.com`).

### 5. Stripe

1. Create a Stripe account and get your **secret key** (`STRIPE_SECRET_KEY`)
2. Create two recurring products in the Stripe dashboard:
   - **Solo** — $8/month → copy the Price ID to `STRIPE_SOLO_PRICE_ID`
   - **Pro** — $15/month → copy the Price ID to `STRIPE_PRO_PRICE_ID`
3. Set up a webhook endpoint pointing to `https://your-api/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 6. Environment files

**Server** — copy `server/.env.example` to `server/.env` and fill in:

```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SOLO_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:you@example.com
PORT=3001
CLIENT_URL=http://localhost:5173
```

**Client** — copy `client/src/.env.example` to `client/.env` and fill in:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3001
VITE_VAPID_PUBLIC_KEY=...
```

### 7. Run locally

```bash
npm run dev
```

- Client: http://localhost:5173
- API:    http://localhost:3001

---

## Plans

| Feature                  | Free | Solo ($8/mo) | Pro ($15/mo) |
|--------------------------|------|-------------|--------------|
| Active rolls             | 5    | Unlimited   | Unlimited    |
| Camera management        | ✓    | ✓           | ✓            |
| Lab tracking             | ✓    | ✓           | ✓            |
| Push notifications       | ✓    | ✓           | ✓            |
| Scan link storage        | —    | ✓           | ✓            |
| Data export              | —    | —           | ✓            |

---

## Project Structure

```
film-roll-tracker/
├── client/
│   ├── public/
│   │   ├── manifest.json
│   │   └── sw.js
│   ├── src/
│   │   ├── components/    # BottomNav, RollCard, StatusBadge, etc.
│   │   ├── contexts/      # AuthContext (Supabase)
│   │   ├── hooks/         # useRolls, useCameras, useFilmStocks
│   │   ├── lib/           # supabase.js, api.js (axios)
│   │   └── pages/         # Dashboard, NewRollPage, RollDetailPage, etc.
│   └── vite.config.js
└── server/
    ├── cron/
    │   └── notifications.js  # Daily 9am push notification job
    ├── middleware/
    │   └── auth.js           # Supabase JWT verification
    ├── routes/               # cameras, rolls, labs, scans, billing, etc.
    ├── db.js                 # pg Pool
    ├── index.js              # Express app entry
    └── schema.sql            # Full DB schema + seed data
```

---

## Deployment

### Server (Railway / Render)
- Set all env vars from `server/.env.example`
- Start command: `node index.js`
- For Stripe webhooks: set `CLIENT_URL` to your production client URL

### Client (Vercel / Netlify)
- Set all env vars from `client/src/.env.example`
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_URL` to your deployed server URL
