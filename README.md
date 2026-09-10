# Asset Tracker

A full-stack asset tracking app with admin/viewer roles, built with React + Supabase + Vercel.

---

## Prerequisites

- **Node.js** 18+ (https://nodejs.org — download the LTS version)
- **Supabase account** (https://supabase.com)
- **Vercel account** for deployment (https://vercel.com)

---

## Step 1 — Set up Supabase (database + auth)

1. Go to **https://supabase.com** and create a free account
2. Click **"New project"**, give it a name, set a strong database password
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** (left sidebar)
5. Click **"New query"**, paste the entire contents of `supabase-schema.sql`, and click **Run**
   - This creates all the tables, permissions, and triggers
6. Go to **Settings → API** (left sidebar)
7. Copy your **Project URL** and **anon public** key — you'll need these next

---

## Step 2 — Set up your local code

1. Open a terminal in this project folder
2. Copy the env file:
   ```
   copy .env.example .env.local
   ```
3. Open `.env.local` and paste in your Supabase URL and anon key:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. Install dependencies:
   ```
   npm install
   ```
5. Run it locally to test:
   ```
   npm run dev
   ```
   Open http://localhost:5173 in your browser

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 5173) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on source files |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |

---

## Step 3 — Create your admin account

1. In Supabase, go to **Authentication → Users → Add user → Create new user**
2. Enter your email and a password
3. Sign in to the app
4. In Supabase, go to **Table Editor → profiles**
5. Find your row and change `role` from `viewer` to `admin`
6. Refresh the app — you now have full admin access

---

## Step 4 — Deploy to Vercel

1. Push this project to a **GitHub repository**
2. Go to **https://vercel.com** and create a free account (sign in with GitHub)
3. Click **"Add New Project"** → import your GitHub repo
4. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy** — Vercel builds and hosts it automatically
6. You'll get a URL like `your-project.vercel.app` — share this with your team

---

## Edge Functions (optional)

The app ships with Supabase Edge Functions for background tasks. Deploy with:

```bash
npx supabase functions deploy manage-user
npx supabase functions deploy send-alerts
npx supabase functions deploy azure-ad-sync
```

Required secrets:

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (from Settings → API) |
| `APP_URL` | Your deployed app URL (e.g. `https://app.vercel.app`) |
| `RESEND_API_KEY` | Resend API key for email alerts |
| `FROM_EMAIL` | Sender email for alerts |
| `ALERT_EMAIL` | Recipient email for alerts |
| `AZURE_TENANT_ID` | Azure AD tenant UUID (for sync) |
| `AZURE_CLIENT_ID` | Azure AD app client ID |
| `AZURE_CLIENT_SECRET` | Azure AD app client secret |

---

## Step 5 — Invite your coworkers

1. In the app, go to the **Users** tab (admin only)
2. Enter an email and click **Invite**
3. They'll get an email to set their password
4. Once they sign up, set their role

---

## Roles

| Feature | Admin | Manager | Viewer |
|---------|-------|---------|--------|
| View all assets | ✓ | ✓ | ✓ |
| Check out / in assets | ✓ | ✓ | — |
| Edit asset details | ✓ | ✓ | — |
| Maintenance logging | ✓ | ✓ | — |
| Manage users | ✓ | — | — |
| View financials | ✓ | ✓ | — |

---

## Project structure

```
asset-tracker/
├── index.html
├── package.json
├── vite.config.js
├── supabase-schema.sql     ← Run in Supabase SQL Editor
├── .env.example            ← Copy to .env.local
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js     ← Supabase client
│   │   ├── AuthContext.jsx ← Login state + roles
│   │   └── hooks.js        ← Custom hooks (useDebounce, useTheme)
│   ├── pages/
│   │   ├── Login.jsx
│   │   └── Dashboard.jsx
│   └── components/
│       ├── Sidebar.jsx
│       ├── UI.jsx          ← Shared UI primitives
│       ├── Inventory.jsx
│       ├── Checkout.jsx
│       ├── Scanner.jsx     ← Barcode/QR scanner
│       ├── Maintenance.jsx
│       ├── History.jsx
│       ├── Users.jsx
│       └── GlobalSearch.jsx
└── supabase/
    └── functions/
        ├── import_map.json
        ├── manage-user/     ← User management actions
        ├── send-alerts/     ← Periodic alert emails
        └── azure-ad-sync/   ← Azure AD employee sync
```

---

## Need help?

- Supabase docs: https://supabase.com/docs
- Vercel docs: https://vercel.com/docs
- Node.js download: https://nodejs.org
