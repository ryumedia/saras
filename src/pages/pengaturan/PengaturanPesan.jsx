import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import '../../styles/PengaturanPesan.css';

export default function PengaturanPesan() {
  const [settings, setSettings] = useState({
    nomorPengirim: '',
    apiKey: '',
    pesanWA: '',
    otomatisAktif: false,
    hariOtomatis: '1' // 1: Senin, 2: Selasa, dst. 0: Minggu
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testing, setTesting] = useState(false);

  const settingsDocRef = doc(db, "pengaturan", "pesan_wa");

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          // Gabungkan data dari DB dengan default state untuk jaga-jaga jika field baru belum ada
          setSettings(prev => ({...prev, ...docSnap.data()}));
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        alert("Gagal memuat pengaturan.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const isCheckbox = e.target.type === 'checkbox';
    setSettings(prev => ({ 
      ...prev, 
      [name]: isCheckbox ? e.target.checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(settingsDocRef, settings, { merge: true });
      alert("Pengaturan berhasil disimpan!");
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!settings.apiKey || !settings.nomorPengirim) {
      alert("Mohon isi API Key dan Nomor Pengirim terlebih dahulu.");
      return;
    }
    if (!testNumber) {
      alert("Mohon isi nomor tujuan tes.");
      return;
    }

    setTesting(true);
    try {
      // Mengirim request ke API Starsender
      const response = await fetch("https://starsender.online/api/sendText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": settings.apiKey
        },
        body: JSON.stringify({
          message: "Tes koneksi dari Aplikasi SARAS berhasil! API Key berfungsi.",
          tujuan: testNumber,
          sender: settings.nomorPengirim
        })
      });

      const result = await response.json();
      
      if (result.status || (result.message && result.message.includes("Success"))) {
         alert("Pesan tes berhasil dikirim! Silakan cek WhatsApp penerima.");
      } else {
         alert("Gagal mengirim pesan: " + (result.message || "Cek API Key atau koneksi."));
      }
    } catch (err) {
      console.error("Error testing message:", err);
      alert("Terjadi kesalahan koneksi ke server WA Gateway.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="pengaturan-container">Memuat pengaturan...</div>;
  }

  return (
    <div className="pengaturan-container">
      <div className="page-header">
        <h1>Pengaturan Pesan WA</h1>
      </div>

      <div className="pengaturan-content">
        <div className="pengaturan-card">
          <form onSubmit={handleSubmit} className="pengaturan-form">
            <div className="form-section">
              <h4>Konfigurasi Starsender</h4>
              <div className="input-group">
                <label>Nomor Pengirim</label>
                <input
                  type="text"
                  name="nomorPengirim"
                  value={settings.nomorPengirim}
                  onChange={handleInputChange}
                  placeholder="Contoh: 6281234567890"
                />
              </div>
              <div className="input-group">
                <label>API Key</label>
                <input
                  type="text"
                  name="apiKey"
                  value={settings.apiKey}
                  onChange={handleInputChange}
                  placeholder="Masukkan API Key dari Starsender"
                />
              </div>
            </div>

            <div className="form-section">
              <h4>Template Pesan</h4>
              <div className="input-group">
                <label>Pesan WA Pengingat</label>
                <textarea
                  name="pesanWA"
                  value={settings.pesanWA}
                  onChange={handleInputChange}
                  rows="6"
                  placeholder="Tulis template pesan di sini..."
                ></textarea>
                <p className="hint-text">
                  Gunakan variabel berikut: <code>{'{nama_siswa}'}</code>, <code>{'{nama_sekolah}'}</code>, <code>{'{bulan}'}</code>, <code>{'{tahun}'}</code>
                </p>
              </div>
            </div>

            <div className="form-section">
              <h4>Test Koneksi</h4>
              <div className="input-group">
                <label>Nomor Tujuan Tes</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    placeholder="Contoh: 6281234567890"
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    onClick={handleTestMessage}
                    disabled={testing}
                    style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      padding: '0 20px',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      cursor: testing ? 'not-allowed' : 'pointer',
                      opacity: testing ? 0.7 : 1
                    }}
                  >
                    {testing ? 'Mengirim...' : 'Test Kirim'}
                  </button>
                </div>
                <p className="hint-text">Pastikan nomor menggunakan format internasional (awalan 628...).</p>
              </div>
            </div>

            <div className="form-section">
              <h4>Pesan Otomatis Mingguan</h4>
              <div className="input-group">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    name="otomatisAktif"
                    checked={settings.otomatisAktif || false}
                    onChange={handleInputChange}
                  />
                  <span className="slider"></span>
                  <span className="label-text">Aktifkan Pengingat Otomatis</span>
                </label>
                <p className="hint-text">Jika aktif, sistem akan mengirim pesan pengingat setiap pekan pada hari yang dipilih ke semua siswa yang masih memiliki stok obat.</p>
              </div>
              {settings.otomatisAktif && (
                <div className="input-group">
                  <label>Kirim Setiap Hari</label>
                  <select 
                    name="hariOtomatis" 
                    value={settings.hariOtomatis} 
                    onChange={handleInputChange}
                  >
                    <option value="1">Senin</option>
                    <option value="2">Selasa</option>
                    <option value="3">Rabu</option>
                    <option value="4">Kamis</option>
                    <option value="5">Jumat</option>
                    <option value="6">Sabtu</option>
                    <option value="0">Minggu</option>
                  </select>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}