#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  Gym Food Tracker - Termux startup script
#  Jalankan bot lebih tahan di-kill Android (Huawei tablet).
# ============================================================
set -e

cd "$(dirname "$0")"

# --- 1. Cek Node.js versi >= 22.5 (karena pakai node:sqlite) ---
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
NODE_MINOR=$(node -e "console.log(process.versions.node.split('.')[1])" 2>/dev/null || echo 0)

if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "ERROR: Butuh Node.js 22.5+. Sekarang versi: $(node --version 2>/dev/null || echo 'tidak terpasang')"
  echo "Pasang dulu:  pkg install nodejs   (lalu upgrade: pkg upgrade)"
  exit 1
fi

# --- 2. Cek .env ---
if [ ! -f .env ]; then
  echo "WARNING: file .env tidak ditemukan. Salin dari contoh:"
  echo "  cp .env.example .env"
  echo "  nano .env"
  exit 1
fi

# --- 3. Install dependensi kalau belum ---
if [ ! -d node_modules ]; then
  echo "Menginstall dependensi..."
  npm install --no-audit --no-fund
fi

# --- 4. Pastikan TERMUX_WAKE_LOCK aktif (jaga proses saat layar mati) ---
if command -v termux-wake-lock >/dev/null 2>&1; then
  echo "Mengaktifkan termux-wake-lock (cegah kill saat layar mati)..."
  termux-wake-lock
fi

# --- 5. Jalankan bot ---
echo "Menjalankan bot (long polling)..."
echo "----------------------------------------"

# --- 5a. Opsi screen: bot tetap jalan walau terminal ditutup ---
if [ "$1" = "screen" ]; then
  if ! command -v screen >/dev/null 2>&1; then
    echo "screen belum terpasang. Pasang:  pkg install screen"
    exit 1
  fi
  if screen -list | grep -q "gymtracker"; then
    echo "Bot sudah berjalan di screen. Cek dengan: screen -r gymtracker"
    exit 0
  fi
  echo "Menjalankan bot di dalam screen (lampirkan: screen -r gymtracker)"
  screen -dmS gymtracker node bot.js
  echo "Bot jalan di background. Tutup terminal ini tidak masalah."
  exit 0
fi

exec node bot.js