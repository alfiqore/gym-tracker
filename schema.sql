-- =========================================================
-- Schema: food + workout tracker
-- Prinsip desain: NORMALIZED, bukan JSON blob.
-- Alasan: kamu butuh query presisi ("bench press minggu lalu",
-- "total kalori hari ini") -- itu jauh lebih murah dan akurat
-- pakai SQL aggregation (SUM, MAX, GROUP BY) di tabel relasional
-- dibanding parsing JSON tiap kali query.
-- =========================================================

-- Simpan raw_text SELALU, di kedua sisi (food & workout).
-- Ini insurance policy kamu: kalau prompt LLM parsing masih jelek
-- di awal, kamu bisa re-parse ulang tanpa minta input ulang.

CREATE TABLE food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    meal_label TEXT,              -- e.g. "meal 2", nullable kalau gak disebut
    raw_text TEXT NOT NULL        -- pesan asli dari Telegram
);

CREATE TABLE food_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_log_id INTEGER NOT NULL REFERENCES food_logs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,           -- "nasi putih", "telor ceplok"
    quantity REAL,                -- 200
    unit TEXT,                    -- "gram", "butir", "porsi"
    calories REAL NOT NULL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    is_estimate INTEGER NOT NULL DEFAULT 1  -- selalu 1 selama pakai LLM estimation, bukan database gizi tervalidasi
);

CREATE TABLE workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    split_type TEXT,              -- "upper", "lower", "push", "pull", "legs"
    raw_text TEXT NOT NULL
);

CREATE TABLE workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,  -- normalisasi nama di application layer (lowercase, trim)
    set_number INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight_kg REAL NOT NULL
);

-- Index buat query yang paling sering dipakai:
-- "riwayat kalori per hari" dan "riwayat exercise tertentu"
CREATE INDEX idx_food_logs_date ON food_logs(logged_at);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(session_date);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_name);

-- =========================================================
-- Contoh query yang jadi ALASAN kenapa schema ini bentuknya begini
-- =========================================================

-- Total kalori hari ini
-- SELECT SUM(fi.calories) FROM food_items fi
-- JOIN food_logs fl ON fl.id = fi.food_log_id
-- WHERE date(fl.logged_at) = date('now', 'localtime');

-- Riwayat bench press minggu lalu (set, reps, beban)
-- SELECT ws.session_date, wst.set_number, wst.reps, wst.weight_kg
-- FROM workout_sets wst
-- JOIN workout_sessions ws ON ws.id = wst.session_id
-- WHERE wst.exercise_name = 'bench press'
--   AND ws.session_date >= date('now', '-7 days')
-- ORDER BY ws.session_date, wst.set_number;

-- Data buat hitung progressive overload: top set (berat tertinggi) per exercise, per sesi terakhir
-- SELECT exercise_name, MAX(weight_kg) as top_weight, reps
-- FROM workout_sets wst
-- JOIN workout_sessions ws ON ws.id = wst.session_id
-- WHERE exercise_name = 'bench press'
-- GROUP BY session_id
-- ORDER BY ws.session_date DESC
-- LIMIT 1;
