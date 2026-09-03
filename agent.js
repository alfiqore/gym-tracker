const toolSchemas = require('./toolSchemas');

const MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-5.2:free';

const SYSTEM_PROMPT = `Kamu adalah asisten tracking gym dan makanan untuk satu user personal via Telegram.
Tugas kamu: pahami maksud pesan bebas user, lalu panggil tool yang sesuai.

Kamu punya konteks percakapan sebelumnya(riwayat chat user dan jawabanmu yang disertakan di akhir pesan ini). GUNOAKAN konteks itu:


- Kalau user bertanya hal yang sudah disebut/dijawab sebelumnya(misal "tadi aku makan apa?", "baru saja log apa?", "kamu bilang apa tadi?") -- jawab langsung dari konteks percakapan itu, JANGAN memanggil tool query kalau jawabannya sudah jelas dari konteks.
- Hanya panggil tool query kalau user bertanya soal data yang perlu dihitung/diambil dari database yang TIDAK ada di konteks percakapan.

Aturan penting:
- Untuk log_food: hitung estimasi kalori dan makro(protein, karbo, lemak) dari pengetahuan gizi umum makanan Indonesia. Di balasan akhir, SELALU sebutkan bahwa ini estimasi, bukan angka presisi dari database gizi.
- Untuk log_workout: pisahkan tiap exercise dan tiap set dengan reps dan beban yang jelas dari teks user.[. Jika user menyebut nama template (misal "Push Day", "pakai template A"), pakai log_workout_from_template.[. Kalau user minta buat/ubah/lihat/hapus template, pakai tool create_workout_template, update_workout_template, get_workout_template, list_workout_templates, atau delete_workout_template sesuai konteks.
- Untuk pertanyaan riwayat/progres/total kalori, WAJIB panggil tool query yang sesuai -- jangan menjawab dari ingatan atau asumsi.
- Untuk saran progressive overload, WAJIB panggil suggest_progressive_overload -- jangan membuat saran sendiri di luar hasil tool ini.
- Untuk menghapus data, WAJIB pakai delete_data DENGAN VERIFIKASI KUAT: panggil dulu dengan confirm=false untuk melihat pratampil jumlah/jenis data yang akan dihapus, lalu tanyakan ke user dengan jelas "yakin hapus [jumlah] data dari tanggal [X] sampai [Y]?". Hanya hapus (confirm=true) setelah user memberi konfirmasi tegas, misal "ya", "hapus", atau "gas". JANGAN pernah langsung hapus tanpa konfirmasi.
- Format date_from/date_to: YYYY-MM-DD. Kalau user bilang "minggu lalu", hitung dari(hari ini - 7 hari)sampai hari ini.
- Setelah dapat hasil tool, susun balasan singkat, natural, ramah, dalam Bahasa Indonesia.

FORMAT TELEGRAM WAJIB:
- Balasan harus TEKS POLOS. JANGAN pakai markdown atau formatting apa pun.
  Tanpa bintang ganda(**) dan bintang tunggal(*), garis bawah(_), tanda pagar(#), tombol, tautan, dan kode blok.
- Untuk daftar, pakai tanda strip "-" atau bullet "•" di awal baris saja, tanpa teks tebal di depannya.
- JANGAN membungkus angka atau kata dengan bintang ganda atau bintang tunggal -- tampilkan polos saja, contoh: "- Telur rebus: 2 butir,  ́140 kkal".`;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function handleMessage({ tools, apiKey, userText, todayIso, model, history = [] }) {
  const activeModel = model || MODEL;
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\nTanggal hari ini: ${todayIso}.` },
    ...history,
    { role: 'user', content: userText }
  ];

  let chartUrl = null;
  const maxTurns = 5;

  for (let turn =0; turn < maxTurns; turn++) {
    let response = null;
    let lastErr = null;

    for (let attempt =0; attempt < 3; attempt++) {
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: activeModel,
            messages,
            tools: toolSchemas
          })
        });
      } catch (err) {
        lastErr = err;
        await sleep(3000);
        continue;
      }

      if (response.ok) break;

      lastErr = response.status;
      if (response.status === 429) {
        await sleep(5000);
      }
    }

    if (!response || !response.ok) {
      return { text: "Mohon maaf, model sedang sibuk atau tidak tersedia sekarang.Coba lagi dalam beberapa menit, ya.", chartUrl };
    }

    const data = await response.json();
    const message = data.choices[0].message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { text: message.content, chartUrl };
    }

    messages.push(message);

    for (const toolCall of message.tool_calls) {
      const fnName = toolCall.function.name;
      let result;
      try {
        const args = JSON.parse(toolCall.function.arguments);
        if (typeof tools[fnName] !== 'function') {
          throw new Error(`Tool tidak dikenal: ${fnName}`);
        }
        result = tools[fnName](args);
        if (fnName === 'get_progress_chart' && result.chart_url) {
          chartUrl = result.chart_url;
        }
      } catch (err) {
        result = { error: err.message };
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  return { text: 'Maaf, permintaan ini butuh terlalu banyak langkah untuk diproses.Coba lebih spesifik.', chartUrl };
}

module.exports = { handleMessage };
