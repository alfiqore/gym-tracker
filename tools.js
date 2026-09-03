function createTools(db) {
  const insertFoodLog = db.prepare(`INSERT INTO food_logs (meal_label, raw_text) VALUES (?, ?)`);
  const insertFoodItem = db.prepare(
    `INSERT INTO food_items (food_log_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g) VALUES (?,?,?,?,?,?,?,?)`
  );
  const insertWorkoutSession = db.prepare(`INSERT INTO workout_sessions (split_type, raw_text) VALUES (?,?)`);
  const insertWorkoutSet = db.prepare(
    `INSERT INTO workout_sets (session_id, exercise_name, set_number, reps, weight_kg) VALUES (?,?,?,?,?)`
  );
  const insertTemplate = db.prepare(`INSERT INTO workout_templates (name, split_type, notes) VALUES (?,?,?)`);
  const insertTemplateExercise = db.prepare(
    `INSERT INTO workout_template_exercises (template_id, exercise_name, set_number, reps, weight_kg) VALUES (?,?,?,?,?)`
  );
  const getTemplatesStmt = db.prepare(`SELECT id, name, split_type, notes FROM workout_templates ORDER BY name`);
  const getTemplateByNameStmt = db.prepare(`SELECT id, name, split_type, notes FROM workout_templates WHERE name = ?`);
  const getTemplateExercisesStmt = db.prepare(
    `SELECT exercise_name, set_number, reps, weight_kg FROM workout_template_exercises WHERE template_id = ? ORDER BY exercise_name, set_number`
  );
  const deleteTemplateStmt = db.prepare(`DELETE FROM workout_templates WHERE name = ?`);

  const queryFoodTotalsStmt = db.prepare(`
    SELECT SUM(fi.calories) as total_calories, SUM(fi.protein_g) as total_protein,
           SUM(fi.carbs_g) as total_carbs, SUM(fi.fat_g) as total_fat
    FROM food_items fi JOIN food_logs fl ON fl.id = fi.food_log_id
    WHERE date(fl.logged_at) BETWEEN date(?) AND date(?)
  `);

  const queryWorkoutHistoryStmt = db.prepare(`
    SELECT ws.session_date, wst.set_number, wst.reps, wst.weight_kg
    FROM workout_sets wst JOIN workout_sessions ws ON ws.id = wst.session_id
    WHERE wst.exercise_name = ? AND ws.session_date BETWEEN date(?) AND date(?)
    ORDER BY ws.session_date, wst.set_number
  `);

  const lastTwoSessionsStmt = db.prepare(`
    SELECT DISTINCT ws.id, ws.session_date
    FROM workout_sets wst JOIN workout_sessions ws ON ws.id = wst.session_id
    WHERE wst.exercise_name = ?
    ORDER BY ws.session_date DESC, ws.id DESC
    LIMIT 2
  `);

  const setsForSessionStmt = db.prepare(`
    SELECT set_number, reps, weight_kg FROM workout_sets
    WHERE session_id = ? AND exercise_name = ?
    ORDER BY set_number
  `);

  const foodLogsByDateStmt = db.prepare(`
    SELECT id, meal_label, raw_text, logged_at FROM food_logs
    WHERE date(logged_at) BETWEEN date(?) AND date(?)
    ORDER BY logged_at DESC
  `);
  const foodLogsByDateAndLabelStmt = db.prepare(`
    SELECT id, meal_label, raw_text, logged_at FROM food_logs
    WHERE date(logged_at) BETWEEN date(?) AND date(?) AND meal_label = ?
    ORDER BY logged_at DESC
  `);
  const workoutSessionsByDateStmt = db.prepare(`
    SELECT id, session_date, split_type, raw_text FROM workout_sessions
    WHERE date(session_date) BETWEEN date(?) AND date(?)
    ORDER BY session_date DESC
  `);
  const workoutSessionsByDateAndExerciseStmt = db.prepare(`
    SELECT DISTINCT ws.id, ws.session_date, ws.split_type, ws.raw_text
    FROM workout_sessions ws
    JOIN workout_sets wst ON wst.session_id = ws.id
    WHERE date(ws.session_date) BETWEEN date(?) AND date(?) AND wst.exercise_name = ?
    ORDER BY ws.session_date DESC
  `);
  const deleteFoodLogsByIdStmt = db.prepare(`DELETE FROM food_logs WHERE id IN (${Array(50).fill('?').join(',')})`);
  const deleteWorkoutSessionsByIdStmt = db.prepare(`DELETE FROM workout_sessions WHERE id IN (${Array(50).fill('?').join(',')})`);

  const dailyCaloriesStmt = db.prepare(`
    SELECT date(fl.logged_at) as day, SUM(fi.calories) as total
    FROM food_items fi JOIN food_logs fl ON fl.id = fi.food_log_id
    WHERE date(fl.logged_at) BETWEEN date(?) AND date(?)
    GROUP BY day ORDER BY day
  `);

  return {
    log_food: ({ meal_label, raw_text, items }) => {
      const logResult = insertFoodLog.run(meal_label || null, raw_text || '');
      const foodLogId = logResult.lastInsertRowid;
      const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      for (const item of items) {
        insertFoodItem.run(
          foodLogId,
          item.name,
          item.quantity ?? null,
          item.unit ?? null,
          item.calories,
          item.protein_g ?? null,
          item.carbs_g ?? null,
          item.fat_g ?? null
        );
        totals.calories += item.calories || 0;
        totals.protein_g += item.protein_g || 0;
        totals.carbs_g += item.carbs_g || 0;
        totals.fat_g += item.fat_g || 0;
      }
      return { food_log_id: foodLogId, totals, note: 'Angka gizi adalah estimasi, bukan dari database gizi tervalidasi.' };
    },

    create_workout_template: ({ name, split_type, exercises, notes }) => {
      const existing = getTemplateByNameStmt.get(name.trim());
      if (existing) {
        return { created: false, message: `Template "${name}" sudah ada. Gunakan update_workout_template untuk mengubah, atau nama yang berbeda.` };
      }
      const res = insertTemplate.run(name.trim(), split_type || null, notes || null);
      const templateId = res.lastInsertRowid;
      let exerciseCount = 0;
      for (const ex of exercises) {
        const ename = ex.exercise_name.toLowerCase().trim();
        (ex.sets || []).forEach((set, idx) => {
          insertTemplateExercise.run(templateId, ename, idx + 1, set.reps ?? null, set.weight_kg ?? null);
          exerciseCount++;
        });
      }
      return { created: true, template_id: templateId, exercise_count: exerciseCount, message: `Template "${name}" berhasil dibuat.` };
    },

    list_workout_templates: () => {
      const templates = getTemplatesStmt.all();
      return {
        templates: templates.map((t) => ({ name: t.name, split_type: t.split_type, notes: t.notes }))
      };
    },

    get_workout_template: ({ name }) => {
      const t = getTemplateByNameStmt.get(name.trim());
      if (!t) return { found: false, message: `Template "${name}" tidak ditemukan.` };
      const exercises = getTemplateExercisesStmt.all(t.id);
      const grouped = {};
      for (const e of exercises) {
        if (!grouped[e.exercise_name]) grouped[e.exercise_name] = [];
        grouped[e.exercise_name].push({ set_number: e.set_number, reps: e.reps, weight_kg: e.weight_kg });
      }
      return {
        found: true,
        name: t.name,
        split_type: t.split_type,
        notes: t.notes,
        exercises: Object.entries(grouped).map(([exercise_name, sets]) => ({ exercise_name, sets }))
      };
    },

    update_workout_template: ({ name, split_type, exercises, notes }) => {
      const t = getTemplateByNameStmt.get(name.trim());
      if (!t) return { updated: false, message: `Template "${name}" tidak ditemukan.` };
      db.prepare(`UPDATE workout_templates SET split_type = ?, notes = ? WHERE id = ?`).run(
        split_type ?? t.split_type,
        notes ?? t.notes,
        t.id
      );
      if (exercises && exercises.length > 0) {
        db.prepare(`DELETE FROM workout_template_exercises WHERE template_id = ?`).run(t.id);
        let exerciseCount = 0;
        for (const ex of exercises) {
          const ename = ex.exercise_name.toLowerCase().trim();
          (ex.sets || []).forEach((set, idx) => {
            insertTemplateExercise.run(t.id, ename, idx + 1, set.reps ?? null, set.weight_kg ?? null);
            exerciseCount++;
          });
        }
      }
      return { updated: true, message: `Template "${name}" berhasil diperbarui.` };
    },

    delete_workout_template: ({ name }) => {
      const t = getTemplateByNameStmt.get(name.trim());
      if (!t) return { deleted: false, message: `Template "${name}" tidak ditemukan.` };
      deleteTemplateStmt.run(name.trim());
      return { deleted: true, message: `Template "${name}" berhasil dihapus.` };
    },

    log_workout_from_template: ({ template_name, raw_text, split_type, overrides }) => {
      const t = getTemplateByNameStmt.get(template_name.trim());
      if (!t) return { logged: false, message: `Template "${template_name}" tidak ditemukan.` };
      const templateExercises = getTemplateExercisesStmt.all(t.id);
      const overrideMap = {};
      for (const ov of overrides || []) {
        const key = ov.exercise_name.toLowerCase().trim();
        overrideMap[key] = (overrideMap[key] || []).concat({ reps: ov.reps, weight_kg: ov.weight_kg });
      }
      const sessionRes = insertWorkoutSession.run(split_type || t.split_type || null, raw_text || `Latihan dari template ${template_name}`);
      const sessionId = sessionRes.lastInsertRowid;
      let setCount = 0;
      for (const e of templateExercises) {
        const key = e.exercise_name;
        const useSets = overrideMap[key] && overrideMap[key].length > 0
          ? overrideMap[key]
          : templateExercises.filter((x) => x.exercise_name === key).map((x) => ({ reps: x.reps, weight_kg: x.weight_kg }));
        useSets.forEach((set, idx) => {
          insertWorkoutSet.run(sessionId, key, idx + 1, set.reps, set.weight_kg);
          setCount++;
        });
      }
      return { logged: true, session_id: sessionId, exercises_logged: new Set(templateExercises.map((e) => e.exercise_name)).size, sets_logged: setCount, message: `Latihan dari template "${template_name}" berhasil dicatat.` };
    },

    delete_data: ({ scope, date_from, date_to, meal_label, exercise_name, confirm = false }) => {
      const dateFrom = date_from || '1970-01-01';
      const dateTo = date_to || '2999-12-31';
      const doFood = scope === 'food' || scope === 'both';
      const doWorkout = scope === 'workout' || scope === 'both';

      let foodLogs = [];
      let workoutSessions = [];

      if (doFood) {
        foodLogs = (meal_label && meal_label.trim())
          ? foodLogsByDateAndLabelStmt.all(dateFrom, dateTo, meal_label.trim())
          : foodLogsByDateStmt.all(dateFrom, dateTo);
      }
      if (doWorkout) {
        workoutSessions = (exercise_name && exercise_name.trim())
          ? workoutSessionsByDateAndExerciseStmt.all(dateFrom, dateTo, exercise_name.trim().toLowerCase())
          : workoutSessionsByDateStmt.all(dateFrom, dateTo);
      }

      const foodLogIds = foodLogs.map((r) => r.id);
      const workoutSessionIds = workoutSessions.map((r) => r.id);

      if (foodLogIds.length === 0 && workoutSessionIds.length === 0) {
        return { deleted: false, food_logs_deleted: 0, workout_sessions_deleted: 0, message: 'Tidak ada data yang cocok untuk rentang dan kriteria tersebut.' };
      }

      if (!confirm) {
        return {
          deleted: false,
          preview: true,
          food_logs: foodLogs.length,
          workout_sessions: workoutSessions.length,
          date_from: dateFrom,
          date_to: dateTo,
          food_samples: foodLogs.slice(0, 5).map((r) => ({ meal_label: r.meal_label, raw_text: r.raw_text })),
          workout_samples: workoutSessions.slice(0, 5).map((r) => ({ split_type: r.split_type, raw_text: r.raw_text })),
          message: 'Ini hanya PRATAMPIL. Belum ada data dihapus. Untuk benar-benar menghapus, panggil ulang tool ini dengan confirm=true setelah user memberi konfirmasi tegas.'
        };
      }

      let deleted = 0;
      if (foodLogIds.length > 0) {
        for (let i = 0; i < foodLogIds.length; i += 50) {
          const chunk = foodLogIds.slice(i, i + 50);
          deleteFoodLogsByIdStmt.run(...chunk);
        }
        deleted += foodLogIds.length;
      }
      if (workoutSessionIds.length > 0) {
        for (let i = 0; i < workoutSessionIds.length; i += 50) {
          const chunk = workoutSessionIds.slice(i, i + 50);
          deleteWorkoutSessionsByIdStmt.run(...chunk);
        }
        deleted += workoutSessionIds.length;
      }

      return {
        deleted: true,
        food_logs_deleted: foodLogIds.length,
        workout_sessions_deleted: workoutSessionIds.length,
        message: `Berhasil menghapus ${foodLogIds.length} log makanan dan ${workoutSessionIds.length} sesi latihan.`
      };
    },

    log_workout: ({ split_type, raw_text, exercises }) => {
      const sessionResult = insertWorkoutSession.run(split_type || null, raw_text || '');
      const sessionId = sessionResult.lastInsertRowid;
      for (const ex of exercises) {
        const name = ex.exercise_name.toLowerCase().trim();
        ex.sets.forEach((set, idx) => {
          insertWorkoutSet.run(sessionId, name, idx + 1, set.reps, set.weight_kg);
        });
      }
      return { session_id: sessionId, exercises_logged: exercises.length };
    },

    query_food_totals: ({ date_from, date_to }) => {
      return queryFoodTotalsStmt.get(date_from, date_to);
    },

    query_workout_history: ({ exercise_name, date_from, date_to }) => {
      const name = exercise_name.toLowerCase().trim();
      const rows = queryWorkoutHistoryStmt.all(name, date_from, date_to);
      return { exercise_name: name, sets: rows };
    },

    suggest_progressive_overload: ({ exercise_name }) => {
      const name = exercise_name.toLowerCase().trim();
      const sessions = lastTwoSessionsStmt.all(name);

      if (sessions.length === 0) {
        return { message: `Belum ada riwayat untuk ${name}.` };
      }

      const latest = setsForSessionStmt.all(sessions[0].id, name);

      if (sessions.length === 1) {
        return {
          exercise_name: name,
          latest_session_date: sessions[0].session_date,
          latest_sets: latest,
          suggestion: 'Baru ada 1 sesi tercatat untuk exercise ini, belum cukup data buat rekomendasi overload. Catat sesi berikutnya dulu.'
        };
      }

      const previous = setsForSessionStmt.all(sessions[1].id, name);
      const minRepsLatest = Math.min(...latest.map((s) => s.reps));
      const maxWeightLatest = Math.max(...latest.map((s) => s.weight_kg));
      const maxWeightPrevious = Math.max(...previous.map((s) => s.weight_kg));

      // Rule deterministik -- LLM tidak boleh mengarang saran di luar ini.
      let suggestion;
      if (minRepsLatest >= 10 && maxWeightLatest >= maxWeightPrevious) {
        const nextWeight = Math.round(maxWeightLatest * 1.025 * 2) / 2; // naik ~2.5%, dibulatkan ke 0.5kg
        suggestion = `Semua set sesi terakhir capai >=10 reps di beban ${maxWeightLatest}kg. Saran: naikkan ke sekitar ${nextWeight}kg sesi berikutnya.`;
      } else if (minRepsLatest < 6) {
        suggestion = `Ada set dengan reps di bawah 6 pada beban ${maxWeightLatest}kg. Saran: pertahankan beban ini dulu, fokus perbaiki teknik/reps sebelum naik beban.`;
      } else {
        suggestion = `Reps sesi terakhir di rentang 6-9. Saran: pertahankan beban ${maxWeightLatest}kg, coba tambah reps di tiap set sebelum naik beban.`;
      }

      return {
        exercise_name: name,
        latest_session_date: sessions[0].session_date,
        latest_sets: latest,
        previous_session_date: sessions[1].session_date,
        suggestion
      };
    },

    get_progress_chart: ({ metric, exercise_name, date_from, date_to }) => {
      let labels = [];
      let data = [];
      let title = '';

      if (metric === 'weight') {
        const name = (exercise_name || '').toLowerCase().trim();
        const rows = queryWorkoutHistoryStmt.all(name, date_from, date_to);
        const maxPerDate = {};
        for (const r of rows) {
          maxPerDate[r.session_date] = Math.max(maxPerDate[r.session_date] || 0, r.weight_kg);
        }
        labels = Object.keys(maxPerDate).sort();
        data = labels.map((d) => maxPerDate[d]);
        title = `Progres beban ${name}`;
      } else {
        const rows = dailyCaloriesStmt.all(date_from, date_to);
        labels = rows.map((r) => r.day);
        data = rows.map((r) => r.total);
        title = 'Total kalori harian';
      }

      const chartConfig = {
        type: 'line',
        data: { labels, datasets: [{ label: title, data }] },
        options: { title: { display: true, text: title } }
      };
      const chart_url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
      return { chart_url, labels, data };
    }
  };
}

module.exports = { createTools };
