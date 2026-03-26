#!/bin/bash
# ============================================================
#  QUANT TERMINAL — View Logs
#  Opens a live tail of the backend log in Terminal.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${ROOT_DIR}/backend/logs/stock_terminal.log"
BACKEND_LOG="${ROOT_DIR}/backend/logs/backend.log"
OLLAMA_LOG="${ROOT_DIR}/logs/ollama.log"

YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; DIM='\033[2m'

echo ""
echo -e "  ${CYAN}LUNAR TERMINAL — Live Logs${NC}"
echo -e "  ${DIM}Press Ctrl+C to stop tailing${NC}"
echo ""

if [ ! -f "${LOG_FILE}" ] && [ ! -f "${BACKEND_LOG}" ] && [ ! -f "${OLLAMA_LOG}" ]; then
  echo -e "  ${YELLOW}⚠${NC}  No log files found yet."
  echo -e "  ${DIM}Start the app first, then re-open this viewer.${NC}"
  echo ""
  read -p "  Press Enter to close..." _
  exit 0
fi

# Tail all available log files simultaneously
FILES=()
[ -f "${LOG_FILE}" ]    && FILES+=("${LOG_FILE}")
[ -f "${BACKEND_LOG}" ] && FILES+=("${BACKEND_LOG}")
[ -f "${OLLAMA_LOG}" ]  && FILES+=("${OLLAMA_LOG}")

echo -e "  Following: ${FILES[*]}"
echo ""

tail -f "${FILES[@]}"
