#!/data/data/com.termux/files/usr/bin/bash
# Hentikan bot yang berjalan di dalam screen
cd "$(dirname "$0")"

if command -v screen >/dev/null 2>&1 && screen -list | grep -q "gymtracker"; then
  screen -S gymtracker -X quit
  echo "Bot di screen dihentikan."
else
  echo "Tidak ada bot yang berjalan di screen (gymtracker)."
fi

if command -v termux-wake-lock >/dev/null 2>&1; then
  echo "Menonaktifkan termux-wake-lock (opsional)."
  termux-wake-lock -c 2>/dev/null || true
fi