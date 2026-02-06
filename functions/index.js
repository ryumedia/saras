/* eslint-env node */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// Set lokasi server ke Jakarta (asia-southeast2) agar lebih cepat
setGlobalOptions({region: "asia-southeast2"});

// Jadwalkan fungsi untuk berjalan setiap hari jam 8 pagi zona Asia/Jakarta
exports.kirimPengingatOtomatis = onSchedule(
    {
      schedule: "every day 08:00",
      timeZone: "Asia/Jakarta",
    },
    async () => {
      console.log("Menjalankan fungsi pengingat otomatis...");

      // 1. Dapatkan hari ini (0=Minggu, 1=Senin, ..., 6=Sabtu)
      const hariIni = new Date().getDay().toString();

      // 2. Ambil pengaturan dari Firestore
      const settingsRef = db.collection("pengaturan").doc("pesan_wa");
      const settingsSnap = await settingsRef.get();

      if (!settingsSnap.exists) {
        console.log("Dokumen pengaturan tidak ditemukan. Fungsi dihentikan.");
        return;
      }

      const settings = settingsSnap.data();

      // 3. Cek apakah fitur aktif dan apakah hari ini adalah hari pengiriman
      if (!settings.otomatisAktif) {
        console.log("Pengingat otomatis tidak aktif. Fungsi dihentikan.");
        return;
      }

      if (settings.hariOtomatis !== hariIni) {
        console.log(`Bukan hari pengiriman. Hari ini: ${hariIni}, Jadwal: ${settings.hariOtomatis}.`);
        return;
      }

      console.log("Pengaturan valid, memulai proses pengiriman...");

      // 4. Ambil semua siswa yang statusnya 'Aktif' dan masih punya stok obat
      const siswaAktifDenganStok = new Set();
      const stokSnap = await db.collection("siswa_stok").where("stok", ">", 0).get();
      stokSnap.forEach((doc) => {
        siswaAktifDenganStok.add(doc.data().siswaId);
      });

      if (siswaAktifDenganStok.size === 0) {
        console.log("Tidak ada siswa dengan stok obat. Fungsi selesai.");
        return;
      }

      const siswaIds = Array.from(siswaAktifDenganStok);
      console.log(`Ditemukan ${siswaIds.length} siswa dengan stok.`);

      // 5. Ambil data profil siswa yang relevan
      // Firestore 'in' query maksimal 10 item, kita perlu batching jika banyak
      // Untuk saat ini kita ambil manual atau loop jika > 10.
      // Solusi aman: Ambil semua siswa aktif lalu filter di memori (jika data < ribuan)
      // Atau loop per 10 ID. Di sini kita pakai cara aman ambil siswa aktif saja.
      const siswaSnap = await db.collection("siswa").where("status", "==", "Aktif").get();

      const siswaData = [];
      siswaSnap.forEach((doc) => {
        if (siswaIds.includes(doc.id) && doc.data().wa) {
          siswaData.push({id: doc.id, ...doc.data()});
        }
      });

      if (siswaData.length === 0) {
        console.log("Tidak ada siswa aktif dengan nomor WA yang valid. Fungsi selesai.");
        return;
      }

      // 6. Ambil data sekolah untuk mapping nama
      const sekolahSnap = await db.collection("sekolah").get();
      const sekolahMap = {};
      sekolahSnap.forEach((doc) => {
        sekolahMap[doc.id] = doc.data().nama;
      });

      // 7. Kirim pesan ke setiap siswa
      const templatePesan = settings.pesanWA || "Halo {nama_siswa}, jangan lupa minum obat minggu ini ya!";
      const fullMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const currentMonthName = fullMonths[new Date().getMonth()];
      const currentYear = new Date().getFullYear();

      const promises = siswaData.map(async (siswa) => {
        const pesan = templatePesan
            .replace(/{nama_siswa}/g, siswa.nama)
            .replace(/{nama_sekolah}/g, sekolahMap[siswa.sekolahId] || "")
            .replace(/{bulan}/g, currentMonthName)
            .replace(/{tahun}/g, currentYear);

        let targetWa = String(siswa.wa).trim().replace(/[^0-9]/g, "");
        if (targetWa.startsWith("0")) {
          targetWa = "62" + targetWa.slice(1);
        }

        console.log(`Mengirim pesan ke ${siswa.nama} ()...`);

        try {
          const response = await fetch("https://starsender.online/api/sendText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": settings.apiKey,
            },
            body: JSON.stringify({
              message: pesan,
              tujuan: targetWa,
              sender: settings.nomorPengirim,
            }),
          });
          const result = await response.json();
          if (result.status || (result.message && result.message.includes("Success"))) {
            console.log(`Pesan ke ${siswa.nama} berhasil dikirim.`);
          } else {
            console.error(`Gagal mengirim pesan ke ${siswa.nama}:`, result.message);
          }
        } catch (error) {
          console.error(`Error saat mengirim ke ${siswa.nama}:`, error);
        }
      });

      await Promise.all(promises);
      console.log("Semua proses pengiriman selesai.");
    },
);
