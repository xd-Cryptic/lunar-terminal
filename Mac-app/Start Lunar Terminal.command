#!/bin/bash
# ============================================================
#  QUANT TERMINAL — One-Click Launcher (macOS)
#  Double-click this file in Finder to start the app.
#  First run: installs all dependencies automatically.
# ============================================================

set -euo pipefail

# ── Colour helpers ───────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

print_header() {
  clear
  echo -e "${BLUE}${BOLD}"
  echo "  ██╗     ██╗   ██╗███╗   ██╗ █████╗ ██████╗ "
  echo "  ██║     ██║   ██║████╗  ██║██╔══██╗██╔══██╗"
  echo "  ██║     ██║   ██║██╔██╗ ██║███████║██████╔╝"
  echo "  ██║     ██║   ██║██║╚██╗██║██╔══██║██╔══██╗"
  echo "  ███████╗╚██████╔╝██║ ╚████║██║  ██║██║  ██║"
  echo "  ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝"
  echo -e "            T E R M I N A L${NC}"
  echo -e "  ${DIM}AI & Quant Trading Terminal${NC}"
  echo -e "  ${DIM}─────────────────────────────────────────────${NC}"
  echo ""
}

log()      { echo -e "  ${GREEN}✔${NC}  $1"; }
warn()     { echo -e "  ${YELLOW}⚠${NC}  $1"; }
error()    { echo -e "  ${RED}✘${NC}  $1"; }
info()     { echo -e "  ${CYAN}→${NC}  $1"; }
step()     { echo -e "\n  ${BOLD}${BLUE}[$1]${NC} $2"; }

# ── Resolve paths relative to this script ───────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
VENV_DIR="${BACKEND_DIR}/.venv"
LOG_DIR="${ROOT_DIR}/logs"

print_header

echo -e "  ${DIM}Lunar Terminal — ${ROOT_DIR}${NC}"
echo ""

# ── 1. Check macOS tools ──────────────────────────────────────
step "1/7" "Checking system requirements..."

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Missing: $1 — $2"
    echo ""
    echo -e "  ${YELLOW}Install guide:${NC}"
    echo -e "  $3"
    echo ""
    read -p "  Press Enter to exit..." _
    exit 1
  fi
  log "$1 $(${1} --version 2>&1 | head -1 | awk '{print $NF}')"
}

check_cmd "node"   "Node.js required for frontend"   "Download from: https://nodejs.org"
check_cmd "npm"    "npm required for frontend"        "Comes with Node.js"
check_cmd "python3" "Python 3 required for backend"   "Install via: brew install python3"

# Check Node version ≥ 18
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  error "Node.js version must be ≥ 18 (found v${NODE_VER})"
  echo -e "  Install newer: ${YELLOW}brew upgrade node${NC}"
  read -p "  Press Enter to exit..." _
  exit 1
fi

# ── 2. Python virtual environment ────────────────────────────
step "2/7" "Setting up Python environment..."

if [ ! -d "${VENV_DIR}" ]; then
  info "Creating virtual environment..."
  python3 -m venv "${VENV_DIR}"
  log "Virtual environment created"
else
  log "Virtual environment exists"
fi

PYTHON="${VENV_DIR}/bin/python"
PIP="${VENV_DIR}/bin/pip"

# Upgrade pip silently (skip if offline)
"${PIP}" install --upgrade pip --quiet --progress-bar off 2>/dev/null || true

# ── 3. Python dependencies ────────────────────────────────────
step "3/7" "Installing Python backend dependencies..."

REQ_CORE="${BACKEND_DIR}/requirements.txt"
REQ_ML="${BACKEND_DIR}/requirements-ml.txt"
INSTALLED_MARKER="${VENV_DIR}/.installed_marker"

# Check if either requirements file is newer than the marker
NEED_PIP=false
if [ ! -f "${INSTALLED_MARKER}" ]; then
  NEED_PIP=true
elif [ "${REQ_CORE}" -nt "${INSTALLED_MARKER}" ]; then
  info "requirements.txt changed — updating..."
  NEED_PIP=true
elif [ -f "${REQ_ML}" ] && [ "${REQ_ML}" -nt "${INSTALLED_MARKER}" ]; then
  info "requirements-ml.txt changed — updating..."
  NEED_PIP=true
fi

if [ "$NEED_PIP" = true ]; then
  info "Installing Python packages (this takes 2-5 min on first run)..."
  echo ""

  # Install both core + ML deps in one pip call to avoid duplicate installs
  PIP_ARGS="-r ${REQ_CORE}"
  if [ -f "${REQ_ML}" ]; then
    PIP_ARGS="${PIP_ARGS} -r ${REQ_ML}"
  fi

  # Spinner + elapsed timer while pip runs in the background
  "${PIP}" install ${PIP_ARGS} > /tmp/lunar_pip.log 2>&1 &
  PIP_PID=$!

  python3 -c "
import sys, time, subprocess
start = time.time()
frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']
i = 0
import os, signal
pid = $PIP_PID
try:
    while True:
        try:
            os.kill(pid, 0)
        except OSError:
            break
        elapsed = int(time.time() - start)
        mins, secs = divmod(elapsed, 60)
        timer = f'{mins}m {secs:02d}s' if mins else f'{secs}s'
        bar_done = min(40, elapsed * 40 // 180)
        bar = '\u2588' * bar_done + '\u2591' * (40 - bar_done)
        sys.stdout.write(f'\r  \033[0;36m{frames[i]}\033[0m  [\033[0;36m{bar}\033[0m]  {timer} elapsed')
        sys.stdout.flush()
        i = (i + 1) % len(frames)
        time.sleep(0.1)
except KeyboardInterrupt:
    pass
sys.stdout.write('\r' + ' ' * 80 + '\r')
sys.stdout.flush()
"
  wait $PIP_PID
  PIP_EXIT=$?

  if [ $PIP_EXIT -ne 0 ]; then
    echo ""
    error "pip install failed. Output:"
    echo ""
    tail -30 /tmp/lunar_pip.log
    echo ""
    warn "Fix the error above, then re-run the launcher."
    read -p "  Press Enter to exit..." _
    exit 1
  fi

  touch "${INSTALLED_MARKER}"
  log "Backend dependencies installed (core + ML)"
else
  log "Backend dependencies up to date"
fi

# ── 4. Node.js dependencies ───────────────────────────────────
step "4/7" "Installing Node.js frontend dependencies..."

NPM_MARKER="${FRONTEND_DIR}/node_modules/.npm_installed_marker"
PKG_FILE="${FRONTEND_DIR}/package.json"
PKG_LOCK="${FRONTEND_DIR}/package-lock.json"

NEED_NPM=false
if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
  NEED_NPM=true
elif [ ! -f "${NPM_MARKER}" ]; then
  NEED_NPM=true
elif [ "${PKG_FILE}" -nt "${NPM_MARKER}" ] || [ "${PKG_LOCK}" -nt "${NPM_MARKER}" ]; then
  info "package.json changed — updating dependencies..."
  NEED_NPM=true
fi

if [ "$NEED_NPM" = true ]; then
  info "Installing Node.js packages..."
  echo ""

  spin() {
    local frames=("\xe2\xa0\x8b" "\xe2\xa0\x99" "\xe2\xa0\xb9" "\xe2\xa0\xb8" "\xe2\xa0\xbc" "\xe2\xa0\xb4" "\xe2\xa0\xa6" "\xe2\xa0\xa7" "\xe2\xa0\x87" "\xe2\xa0\x8f")
    local i=0
    while kill -0 "$1" 2>/dev/null; do
      printf "\r  \033[0;36m%s\033[0m  npm install running..." "${frames[$i]}"
      i=$(( (i+1) % 10 ))
      sleep 0.1
    done
    printf "\r  %-55s\r" " "
  }

  cd "${FRONTEND_DIR}" && npm install --no-fund --no-audit > /tmp/lunar_npm.log 2>&1 &
  NPM_PID=$!
  spin $NPM_PID
  wait $NPM_PID && NPM_EXIT=$? || NPM_EXIT=$?

  if [ "$NPM_EXIT" -ne 0 ]; then
    error "npm install failed:"
    tail -20 /tmp/lunar_npm.log
    read -p "  Press Enter to exit..." _
    exit 1
  fi

  touch "${NPM_MARKER}"
  log "Frontend dependencies installed"
else
  log "Frontend dependencies up to date"
fi

# ── 5. Create log directory ───────────────────────────────────
step "5/7" "Preparing environment..."

mkdir -p "${LOG_DIR}"
mkdir -p "${BACKEND_DIR}/logs"
mkdir -p "${BACKEND_DIR}/algos"
mkdir -p "${BACKEND_DIR}/algos/models"

# Copy .env if missing
if [ ! -f "${BACKEND_DIR}/.env" ] && [ -f "${BACKEND_DIR}/.env.example" ]; then
  cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
  warn "Created backend/.env from example — please update your API keys in Settings"
fi

if [ ! -f "${FRONTEND_DIR}/.env" ] && [ -f "${FRONTEND_DIR}/.env.example" ]; then
  cp "${FRONTEND_DIR}/.env.example" "${FRONTEND_DIR}/.env"
fi

log "Environment prepared"

# ── 6. Ollama AI Engine ──────────────────────────────────────
step "6/7" "Setting up Ollama AI engine (qwen3:2b + RAG)..."

OLLAMA_STARTED_BY_US=false

if ! command -v ollama &>/dev/null; then
  warn "Ollama not installed — AI analysis will be unavailable"
  warn "Install from: https://ollama.com/download"
else
  log "Ollama found: $(ollama --version 2>&1 | head -1)"

  # Check if Ollama is already serving
  if ! curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; then
    info "Starting Ollama server..."
    ollama serve >> "${LOG_DIR}/ollama.log" 2>&1 &
    OLLAMA_PID=$!
    OLLAMA_STARTED_BY_US=true

    # Wait for Ollama to be ready (up to 15s)
    OCOUNT=0
    until curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; do
      OCOUNT=$((OCOUNT+1))
      if [ $OCOUNT -ge 15 ]; then
        warn "Ollama did not start in time — AI features may be delayed"
        break
      fi
      sleep 1
      printf "  ${DIM}.${NC}"
    done
    echo ""
    if curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; then
      log "Ollama server running (PID ${OLLAMA_PID})"
    fi
  else
    log "Ollama already running"
  fi

  # Determine which models to pull from .env or defaults
  OLLAMA_MODEL="qwen3:2b"
  EMBED_MODEL="nomic-embed-text"
  if [ -f "${BACKEND_DIR}/.env" ]; then
    ENV_MODEL=$(grep -E "^OLLAMA_MODEL=" "${BACKEND_DIR}/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    ENV_EMBED=$(grep -E "^OLLAMA_EMBED_MODEL=" "${BACKEND_DIR}/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    [ -n "$ENV_MODEL" ] && OLLAMA_MODEL="${ENV_MODEL}"
    [ -n "$ENV_EMBED" ] && EMBED_MODEL="${ENV_EMBED}"
  fi

  # Pull required models if not already present
  # Use `ollama list` for reliable model detection (works offline)
  INSTALLED_MODELS=$(ollama list 2>/dev/null || echo "")

  pull_if_missing() {
    local MODEL_NAME="$1"
    local MODEL_DESC="$2"
    if echo "${INSTALLED_MODELS}" | grep -q "${MODEL_NAME}" 2>/dev/null; then
      log "${MODEL_NAME} model available"
    else
      info "Pulling ${MODEL_NAME} ${MODEL_DESC}..."
      if ollama pull "${MODEL_NAME}" 2>&1 | while IFS= read -r line; do
        printf "\r  ${DIM}%s${NC}%-20s" "  " "${line:0:60}"
      done; then
        echo ""
        log "${MODEL_NAME} model ready"
      else
        echo ""
        warn "${MODEL_NAME} pull failed (no internet?) — pull manually later: ollama pull ${MODEL_NAME}"
      fi
    fi
  }

  pull_if_missing "${OLLAMA_MODEL}" "(first run only)"
  pull_if_missing "${EMBED_MODEL}" "(RAG embeddings, ~275 MB)"

  info "LLM: ${OLLAMA_MODEL}  |  Embed: ${EMBED_MODEL}"
fi

# ── 7. Launch ─────────────────────────────────────────────────
step "7/7" "Launching Lunar Terminal..."

echo ""
echo -e "  ${GREEN}${BOLD}Starting...${NC}"
echo -e "  ${DIM}Backend  → http://localhost:8787${NC}"
echo -e "  ${DIM}Ollama   → http://localhost:11434 (${OLLAMA_MODEL:-qwen3:2b} + ${EMBED_MODEL:-nomic-embed-text})${NC}"
echo -e "  ${DIM}Frontend → Vite + Electron${NC}"
echo -e "  ${DIM}Logs     → ${BACKEND_DIR}/logs/stock_terminal.log${NC}"
echo ""
echo -e "  ${DIM}Press Ctrl+C to stop all processes${NC}"
echo ""

# Trap to kill all children on exit
cleanup() {
  echo ""
  echo -e "  ${YELLOW}Shutting down...${NC}"
  kill "$(jobs -p)" 2>/dev/null || true
  if [ "$OLLAMA_STARTED_BY_US" = true ] && [ -n "${OLLAMA_PID:-}" ]; then
    kill "$OLLAMA_PID" 2>/dev/null || true
    echo -e "  ${GREEN}✔${NC}  Ollama stopped"
  fi
  echo -e "  ${GREEN}Goodbye!${NC}"
}
trap cleanup EXIT INT TERM

# Start backend
BACKEND_LOG="${BACKEND_DIR}/logs/backend.log"
cd "${BACKEND_DIR}"

"${PYTHON}" -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8787 \
  --reload \
  --log-level info \
  >> "${BACKEND_LOG}" 2>&1 &

BACKEND_PID=$!
info "Backend started (PID ${BACKEND_PID}) — logging to logs/backend.log"

info "Waiting for backend to be ready..."
MAX_WAIT=30
COUNT=0
until curl -sf "http://localhost:8787/health" >/dev/null 2>&1; do
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_WAIT ]; then
    error "Backend failed to start after ${MAX_WAIT}s"
    error "Check logs: ${BACKEND_LOG}"
    read -p "  Press Enter to exit..." _
    exit 1
  fi
  sleep 1
  printf "  ${DIM}.${NC}"
done
echo ""
log "Backend ready ✔"

# Launch Lunar Terminal (dev mode: Vite + Electron via concurrently)
cd "${FRONTEND_DIR}"
npm run dev

# (npm run dev blocks until Electron closes — cleanup trap fires on exit)
