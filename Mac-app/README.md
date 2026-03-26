# Lunar Terminal — Mac Launcher

Double-click any of the `.command` files in Finder to run them.

> **First launch takes ~2 minutes** to install all dependencies automatically. After that it's instant.

---

## Files

| File | What it does |
|------|-------------|
| `Start Stock Terminal.command` | **Main launcher** — installs deps if needed, starts backend + Electron |
| `Stop Stock Terminal.command` | Cleanly kills all running processes |
| `View Logs.command` | Live tail of backend logs in Terminal |

---

## First Time Setup (One-Time)

macOS may block the scripts with a security warning on first run.

**Fix in 2 steps:**
1. Right-click → **Open** (instead of double-clicking)
2. Click **Open** in the security dialog

After doing this once, double-click works normally forever.

---

## What the Launcher Checks

1. **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
2. **Python 3** — `brew install python3`
3. **Python venv** — created automatically if missing
4. **Backend packages** — installed from `backend/requirements.txt`
5. **Frontend packages** — `npm install` runs if `node_modules` missing
6. **Backend health** — waits up to 30s for `http://localhost:8787/health`
7. **Electron** — launched via `npm run dev`

---

## Ports Used

| Service | Port |
|---------|------|
| Python backend (FastAPI) | `8787` |
| Vite dev server | `5173` |

---

## Log Files

```
backend/logs/stock_terminal.log   ← structured JSON logs (rotated)
backend/logs/backend.log          ← uvicorn stdout/stderr
```

Or open the **Log Console** inside the app with the `` ` `` (backtick) key.

---

## Troubleshooting

**Port already in use:**
```bash
lsof -ti :8787 | xargs kill -9
lsof -ti :5173 | xargs kill -9
```

**Resetting dependencies:**
```bash
rm -rf backend/.venv frontend/node_modules
# Then re-run Start Stock Terminal.command
```

**Python packages failing:**
```bash
cd backend && source .venv/bin/activate
pip install -r requirements.txt
```
