# Asset Tracker — Deployment Guide

A full-stack asset tracking app with admin/viewer roles, built with React + Supabase + Vercel.

---

## Step 1 — Set up Supabase (your database + auth)

1. Go to **https://supabase.com** and create a free account
2. Click **"New project"**, give it a name (e.g. "asset-tracker"), set a strong database password
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** (left sidebar)
5. Click **"New query"**, paste the entire contents of `supabase-schema.sql`, and click **Run**
   - This creates all the tables, permissions, and triggers
6. Go to **Settings → API** (left sidebar)
7. Copy your **Project URL** and **anon public** key — you'll need these next

---

## Step 2 — Set up your local code

1. Make sure you have **Node.js** installed (https://nodejs.org — download the LTS version)
2. Open a terminal in this project folder
3. Copy the env file:
   ```
   cp .env.example .env.local
   ```
4. Open `.env.local` and paste in your Supabase URL and anon key:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
5. Install dependencies:
   ```
   npm install
   ```
6. Run it locally to test:
   ```
   npm run dev
   ```
   Open http://localhost:5173 in your browser

---

## Step 3 — Create your admin account

1. In Supabase, go to **Authentication → Users → Add user → Create new user**
2. Enter your email and a password
3. Sign in to the app at http://localhost:5173
4. In Supabase, go to **Table Editor → profiles**
5. Find your row and change `role` from `viewer` to `admin`
6. Refresh the app — you now have full admin access

---

## Step 4 — Deploy to Vercel (free hosting)

1. Push this project to a **GitHub repository**:
   - Go to https://github.com and create a free account if needed
   - Create a new repository, push this code to it
2. Go to **https://vercel.com** and create a free account (sign in with GitHub)
3. Click **"Add New Project"** → import your GitHub repo
4. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy** — Vercel builds and hosts it automatically
6. You'll get a URL like `your-project.vercel.app` — share this with your team

---

## Step 5 — Invite your coworkers

1. In Supabase, go to **Authentication → Users → Invite**
2. Enter their email address and click Send
3. They'll get an email to set their password
4. Once they sign up, go to your app → **Users tab** (admin only)
5. Set their role to **Admin** or leave as **Viewer**

---

## Roles explained

| Feature | Admin | Viewer |
|---------|-------|--------|
| View all assets | ✓ | ✓ |
| View check-out status | ✓ | ✓ |
| View maintenance records | ✓ | ✓ |
| View activity history | ✓ | ✓ |
| Add / edit / delete assets | ✓ | — |
| Check assets in/out | ✓ | — |
| Log maintenance | ✓ | — |
| Manage user roles | ✓ | — |

---

## Project structure

```
asset-tracker/
├── index.html
├── package.json
├── vite.config.js
├── supabase-schema.sql     ← Run this in Supabase SQL Editor
├── .env.example            ← Copy to .env.local and fill in your keys
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── lib/
    │   ├── supabase.js     ← Supabase client
    │   └── AuthContext.jsx ← Login state + role
    ├── pages/
    │   ├── Login.jsx
    │   └── Dashboard.jsx
    └── components/
        ├── Sidebar.jsx
        ├── UI.jsx          ← Shared components
        ├── Inventory.jsx
        ├── Checkout.jsx
        ├── Maintenance.jsx
        ├── History.jsx
        └── Users.jsx
```

---

## Need help?

- Supabase docs: https://supabase.com/docs
- Vercel docs: https://vercel.com/docs
- Node.js download: https://nodejs.org
