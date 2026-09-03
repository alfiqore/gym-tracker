module.exports = [
  {
    type: 'function',
    function: {
      name: 'log_food',
      description: 'Simpan log makanan yang dimakan user, dengan estimasi kalori dan makro per item yang sudah dihitung oleh asisten dari pengetahuan gizi umum.',
      parameters: {
        type: 'object',
        properties: {
          meal_label: { type: 'string', description: 'Label meal jika disebutkan user, misal "meal 2", "sarapan". Kosongkan jika tidak disebut.' },
          raw_text: { type: 'string', description: 'Teks asli pesan user, verbatim.' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                calories: { type: 'number' },
                protein_g: { type: 'number' },
                carbs_g: { type: 'number' },
                fat_g: { type: 'number' }
              },
              required: ['name', 'calories']
            }
          }
        },
        required: ['raw_text', 'items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_workout',
      description: 'Simpan sesi latihan gym user, sudah dipecah per exercise dan per set (reps, beban).',
      parameters: {
        type: 'object',
        properties: {
          split_type: { type: 'string', description: 'Contoh: upper, lower, push, pull, legs. Kosongkan jika tidak jelas dari teks.' },
          raw_text: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: { type: 'string' },
                sets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      reps: { type: 'integer' },
                      weight_kg: { type: 'number' }
                    },
                    required: ['reps', 'weight_kg']
                  }
                }
              },
              required: ['exercise_name', 'sets']
            }
          }
        },
        required: ['raw_text', 'exercises']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_food_totals',
      description: 'Ambil total kalori dan makro user dalam rentang tanggal tertentu. WAJIB dipanggil untuk pertanyaan soal total kalori -- jangan dijawab dari asumsi.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Format YYYY-MM-DD' },
          date_to: { type: 'string', description: 'Format YYYY-MM-DD' }
        },
        required: ['date_from', 'date_to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_workout_history',
      description: 'Ambil riwayat set/reps/beban untuk satu exercise dalam rentang tanggal. WAJIB dipanggil untuk pertanyaan soal riwayat latihan -- jangan dijawab dari ingatan.',
      parameters: {
        type: 'object',
        properties: {
          exercise_name: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' }
        },
        required: ['exercise_name', 'date_from', 'date_to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_progressive_overload',
      description: 'Beri saran progressive overload berbasis rule deterministik dari riwayat 2 sesi terakhir exercise tertentu. WAJIB dipanggil untuk pertanyaan soal saran overload -- jangan membuat saran sendiri.',
      parameters: {
        type: 'object',
        properties: {
          exercise_name: { type: 'string' }
        },
        required: ['exercise_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_progress_chart',
      description: 'Buat grafik progres: beban exercise tertentu dari waktu ke waktu, atau kalori harian dalam rentang tanggal.',
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['weight', 'calories'] },
          exercise_name: { type: 'string', description: 'Wajib diisi jika metric=weight' },
          date_from: { type: 'string' },
          date_to: { type: 'string' }
        },
        required: ['metric', 'date_from', 'date_to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_data',
      description: 'Hapus data makanan dan/atau latihan dalam rentang tanggal (opsional filter meal_label untuk makanan, exercise_name untuk latihan). PENTING: panggil DULU tanpa confirm untuk melihat pratampil jumlah data yang akan dihapus, lalu tanyakan konfirmasi tegas ke user. Baru hapus dengan confirm=true setelah user jelas menyetujui. Verifikasi kuat wajib dilakukan.',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['food', 'workout', 'both'], description: 'Bagian data mana yang dihapus.' },
          date_from: { type: 'string', description: 'Format YYYY-MM-DD. Batas awal rentang tanggal.' },
          date_to: { type: 'string', description: 'Format YYYY-MM-DD. Batas akhir rentang tanggal.' },
          meal_label: { type: 'string', description: 'Opsional. Filter hanya log makanan dengan meal_label tertentu.' },
          exercise_name: { type: 'string', description: 'Opsional. Filter hanya sesi latihan yang mengandung exercise ini.' },
          confirm: { type: 'boolean', description: 'false = hanya pratampil (tidak menghapus apa pun). true = benar-benar hapus. Harus false dulu, lalu true setelah konfirmasi user.' }
        },
        required: ['scope', 'date_from', 'date_to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_workout_template',
      description: 'Buat template latihan baru yang bisa dipakai ulang. Parameter exercises berisi daftar exercise, masing-masing dengan sets (set ke berapa, reps, weight_kg). User bisa bikin template sendiri lalu dipakai untuk catat latihan.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama template, misal "Push Day", "Leg Day A".' },
          split_type: { type: 'string', description: 'Opsional, misal push, pull, legs, upper, lower.' },
          notes: { type: 'string', description: 'Opsional catatan.' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: { type: 'string' },
                sets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      reps: { type: 'integer' },
                      weight_kg: { type: 'number' }
                    }
                  }
                }
              },
              required: ['exercise_name']
            }
          }
        },
        required: ['name', 'exercises']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_workout_templates',
      description: 'Ambil daftar semua template latihan yang tersimpan.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_workout_template',
      description: 'Ambil detail satu template latihan termasuk semua exercise dan set-nya.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_workout_template',
      description: 'Perbarui template latihan yang sudah ada (bisa ganti split_type, notes, dan/atau daftar exercises + sets).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          split_type: { type: 'string' },
          notes: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: { type: 'string' },
                sets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      reps: { type: 'integer' },
                      weight_kg: { type: 'number' }
                    }
                  }
                }
              },
              required: ['exercise_name']
            }
          }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_workout_template',
      description: 'Hapus template latihan berdasarkan nama.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_workout_from_template',
      description: 'Catat sesi latihan hari ini dengan memakai template yang sudah ada. Opsional overrides untuk menyesuaikan reps/beban salah satu exercise pada sesi ini saja. Gunakan ini kalau user bilang "catat latihan pakai template [nama]".',
      parameters: {
        type: 'object',
        properties: {
          template_name: { type: 'string' },
          raw_text: { type: 'string' },
          split_type: { type: 'string' },
          overrides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: { type: 'string' },
                reps: { type: 'integer' },
                weight_kg: { type: 'number' }
              }
            }
          }
        },
        required: ['template_name']
      }
    }
  }
];
