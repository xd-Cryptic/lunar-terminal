#!/bin/bash
# ============================================================
#  LUNAR TERMINAL — Stop All Processes
#  Double-click to cleanly stop the backend and frontend.
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo ""
echo -e "  ${YELLOW}Stopping Lunar Terminal...${NC}"
echo ""

# Kill uvicorn (backend)
BACKEND_PIDS=$(pgrep -f "uvicorn main:app" 2>/dev/null || true)
if [ -n "$BACKEND_PIDS" ]; then
  echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null || true
  echo -e "  ${GREEN}✔${NC}  Backend stopped"
else
  echo -e "  ○  Backend was not running"
fi

# Kill Electron
ELECTRON_PIDS=$(pgrep -f "electron" 2>/dev/null || true)
if [ -n "$ELECTRON_PIDS" ]; then
  echo "$ELECTRON_PIDS" | xargs kill -9 2>/dev/null || true
  echo -e "  ${GREEN}✔${NC}  Electron stopped"
else
  echo -e "  ○  Electron was not running"
fi

# Kill Vite dev server
VITE_PIDS=$(pgrep -f "vite" 2>/dev/null || true)
if [ -n "$VITE_PIDS" ]; then
  echo "$VITE_PIDS" | xargs kill -9 2>/dev/null || true
  echo -e "  ${GREEN}✔${NC}  Vite dev server stopped"
fi

# Kill Ollama and unload models to free VRAM/RAM
if command -v ollama &>/dev/null; then
  # Unload all loaded models first (frees GPU/RAM while server is still up)
  LOADED=$(curl -sf http://localhost:11434/api/ps 2>/dev/null)
  if [ -n "$LOADED" ] && echo "$LOADED" | grep -q '"models"'; then
    MODELS=$(echo "$LOADED" | python3 -c "import sys,json; [print(m['name']) for m in json.load(sys.stdin).get('models',[])]" 2>/dev/null || true)
    for m in $MODELS; do
      curl -sf http://localhost:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" >/dev/null 2>&1 || true
      echo -e "  ${GREEN}✔${NC}  Unloaded model: $m"
    done
  fi

  # Kill ollama serve process
  OLLAMA_PIDS=$(pgrep -f "ollama serve" 2>/dev/null || true)
  if [ -n "$OLLAMA_PIDS" ]; then
    echo "$OLLAMA_PIDS" | xargs kill 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    OLLAMA_PIDS=$(pgrep -f "ollama serve" 2>/dev/null || true)
    if [ -n "$OLLAMA_PIDS" ]; then
      echo "$OLLAMA_PIDS" | xargs kill -9 2>/dev/null || true
    fi
    echo -e "  ${GREEN}✔${NC}  Ollama stopped"
  else
    echo -e "  ○  Ollama was not running"
  fi

  # Kill any orphan ollama_llama_server / ollama runner processes
  RUNNER_PIDS=$(pgrep -f "ollama_llama_server|ollama runner" 2>/dev/null || true)
  if [ -n "$RUNNER_PIDS" ]; then
    echo "$RUNNER_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "  ${GREEN}✔${NC}  Ollama runner processes killed"
  fi
else
  echo -e "  ○  Ollama not installed"
fi

# Release ports 8787 (backend) and 11434 (ollama)
lsof -ti :8787 | xargs kill -9 2>/dev/null || true
lsof -ti :11434 | xargs kill -9 2>/dev/null || true

echo ""
echo -e "  ${GREEN}All processes stopped. GPU/RAM freed.${NC}"
echo ""
read -p "  Press Enter to close..." _
