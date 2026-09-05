import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, firebaseConfig } from './firebase';
import { doc, getDoc, collection, getDocs, setDoc, where, query as fsQuery } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword as createSecondaryUser, getAuth as getSecondaryAuth, signOut as signOutSecondary } from 'firebase/auth';
import { getFirestore as getSecondaryFirestore } from 'firebase/firestore';
import './styles/Modal.css';
import logoSaras from './assets/Logo.png';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

const DEFAULT_PASSWORD = '123456';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // State Pendaftaran Siswa
  const [showDaftarModal, setShowDaftarModal] = useState(false);
  const [daftarForm, setDaftarForm] = useState({ nama: '', email: '', wa: '', sekolahId: '', kelasId: '' });
  const [sekolahOptions, setSekolahOptions] = useState([]);
  const [kelasOptions, setKelasOptions] = useState([]);
  const [daftarLoading, setDaftarLoading] = useState(false);
  const [daftarError, setDaftarError] = useState('');
  const [daftarSuccess, setDaftarSuccess] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Cek role user untuk redirection
      let userDoc = await getDoc(doc(db, 'admins', user.uid));
      if (userDoc.exists()) {
        // Ini adalah Admin/Super Admin
        navigate('/');
      } else {
        userDoc = await getDoc(doc(db, 'siswa', user.uid));
        if (userDoc.exists()) {
          // Ini adalah Siswa
          navigate('/app');
        } else {
          throw new Error("Profil pengguna tidak ditemukan.");
        }
      }
    } catch (err) {
      setError('Gagal login. Periksa kembali email dan password Anda.');
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openDaftarModal = async () => {
    setShowDaftarModal(true);
    setDaftarError('');
    setDaftarSuccess('');
    setDaftarForm({ nama: '', email: '', wa: '', sekolahId: '', kelasId: '' });
    try {
      const snap = await getDocs(collection(db, 'sekolah'));
      console.log('Jumlah sekolah terbaca:', snap.size);
      setSekolahOptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (snap.empty) {
        setDaftarError('Data sekolah tidak dapat dimuat. Mungkin akses ditolak (Firestore Rules) atau data sekolah kosong.');
      }
    } catch (err) {
      console.error('Gagal mengambil data sekolah:', err);
      setDaftarError('Gagal memuat data sekolah: ' + err.message + '. Kemungkinan Firestore Rules memblokir akses tanpa login.');
    }
  };

  const handleDaftarChange = (e) => {
    const { name, value } = e.target;
    if (name === 'sekolahId') {
      // Reset kelas saat sekolah berubah
      setDaftarForm(prev => ({ ...prev, sekolahId: value, kelasId: '' }));
      if (value) {
        // Ambil kelas sesuai sekolah yang dipilih
        getDocs(fsQuery(collection(db, 'kelas'), where('sekolahId', '==', value)))
          .then(snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (parseInt(a.rombel) || 0) - (parseInt(b.rombel) || 0) || a.namaKelas.localeCompare(b.namaKelas));
            setKelasOptions(list);
          })
          .catch(err => console.error('Gagal mengambil data kelas:', err));
      } else {
        setKelasOptions([]);
      }
    } else {
      setDaftarForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDaftar = async (e) => {
    e.preventDefault();
    setDaftarError('');
    setDaftarSuccess('');

    const { nama, email, wa, sekolahId, kelasId } = daftarForm;
    if (!nama || !email || !wa || !sekolahId || !kelasId) {
      setDaftarError('Mohon lengkapi semua data.');
      return;
    }
    if (!wa.startsWith('62')) {
      setDaftarError('Nomor WA harus diawali dengan 62.');
      return;
    }

    setDaftarLoading(true);
    try {
      // Catatan: tidak perlu query pre-check email, karena Firebase Auth menjamin
      // keunikan email. Jika email sudah terdaftar, createUserWithEmailAndPassword
      // otomatis gagal dengan 'auth/email-already-in-use' (ditangani di bawah).

      // 1. Buat akun Auth menggunakan Secondary App agar sesi login saat ini tidak terganggu
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryDaftar');
      const secondaryAuth = getSecondaryAuth(secondaryApp);
      const secondaryDb = getSecondaryFirestore(secondaryApp);
      let uid;
      try {
        const userCredential = await createSecondaryUser(secondaryAuth, email, DEFAULT_PASSWORD);
        uid = userCredential.user.uid;
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          setDaftarError('Email sudah terdaftar. Silakan login atau gunakan email lain.');
        } else {
          console.error(authErr);
          setDaftarError('Gagal mendaftar: ' + authErr.message);
        }
        await signOutSecondary(secondaryAuth);
        deleteApp(secondaryApp);
        setDaftarLoading(false);
        return;
      }
      // 2. Cari data kelas untuk mendapatkan rombel
      const kelasDoc = kelasOptions.find(k => k.id === kelasId);

      // 3. Simpan ke data siswa dengan status default 'Aktif'
      // PENTING: ditulis memakai secondaryDb SELAGI user baru masih login di
      // secondary app, agar lolos rules 'create: if request.auth.uid == siswaId'.
      try {
        await setDoc(doc(secondaryDb, 'siswa', uid), {
          nama,
          email,
          wa,
          kelas: kelasDoc ? kelasDoc.rombel : '7',
          kelasId,
          sekolahId,
          status: 'Aktif',
          createdAt: new Date()
        });
      } catch (dbErr) {
        console.error('Gagal menyimpan data siswa:', dbErr);
        setDaftarError('Akun terbuat tapi gagal menyimpan data siswa: ' + dbErr.message);
        await signOutSecondary(secondaryAuth);
        deleteApp(secondaryApp);
        setDaftarLoading(false);
        return;
      }

      await signOutSecondary(secondaryAuth);
      deleteApp(secondaryApp);

      setDaftarSuccess('Pendaftaran berhasil! Silakan login dengan password default: 123456');
      setDaftarForm({ nama: '', email: '', wa: '', sekolahId: '', kelasId: '' });
    } catch (err) {
      console.error('Error pendaftaran:', err);
      setDaftarError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setDaftarLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');

    if (!resetEmail) {
      setResetError('Mohon masukkan email.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Link reset password telah dikirim ke email Anda.');
      setResetEmail('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setResetError('Email tidak terdaftar.');
      } else {
        setResetError('Gagal mengirim email reset. Silakan coba lagi.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logoSaras} alt="Logo Saras" className="login-logo" />
        <h2>(SAhabat RemajA Sehat)</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#045f5a' }} />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={20} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#045f5a' }} />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: '40px', paddingRight: '40px', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#666',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          {error && <p className="error-message">{error}</p>}

          <div style={{ textAlign: 'right', marginBottom: '1rem', marginTop: '-0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              style={{ background: 'none', border: 'none', color: '#00B5AC', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
            >
              Lupa Password?
            </button>
          </div>

          <button type="submit" className="login-button" disabled={isLoggingIn}>
            {isLoggingIn ? 'Memproses...' : 'Login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.95rem', color: '#555' }}>
          Belum Punya Akun?{' '}
          <button
            type="button"
            onClick={openDaftarModal}
            style={{ background: 'none', border: 'none', color: '#00B5AC', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', padding: 0, fontSize: '0.95rem' }}
          >
            DAFTAR DISINI
          </button>
        </p>
      </div>

      {/* Modal Pendaftaran */}
      {showDaftarModal && (
        <div className="modal-overlay" onClick={() => setShowDaftarModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h2 style={{ marginTop: 0 }}>Pendaftaran Siswa</h2>
            <form onSubmit={handleDaftar}>
              <div className="input-group">
                <label htmlFor="daftarNama">Nama</label>
                <input type="text" id="daftarNama" name="nama" value={daftarForm.nama} onChange={handleDaftarChange} required placeholder="Nama lengkap" />
              </div>
              <div className="input-group">
                <label htmlFor="daftarEmail">Email</label>
                <input type="email" id="daftarEmail" name="email" value={daftarForm.email} onChange={handleDaftarChange} required placeholder="nama@email.com" />
              </div>
              <div className="input-group">
                <label htmlFor="daftarWa">No. WA</label>
                <input type="text" id="daftarWa" name="wa" value={daftarForm.wa} onChange={handleDaftarChange} required placeholder="Contoh: 6281234567890" />
              </div>
              <div className="input-group">
                <label htmlFor="daftarSekolah">Pilih Sekolah</label>
                <select id="daftarSekolah" name="sekolahId" value={daftarForm.sekolahId} onChange={handleDaftarChange} required>
                  <option value="">-- Pilih Sekolah --</option>
                  {sekolahOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.nama}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="daftarKelas">Pilih Kelas</label>
                <select id="daftarKelas" name="kelasId" value={daftarForm.kelasId} onChange={handleDaftarChange} required disabled={!daftarForm.sekolahId}>
                  <option value="">-- Pilih Kelas --</option>
                  {kelasOptions.map(k => (
                    <option key={k.id} value={k.id}>{k.namaKelas}</option>
                  ))}
                </select>
              </div>

              {daftarError && <p className="error-message" style={{ marginBottom: '10px' }}>{daftarError}</p>}
              {daftarSuccess && <p style={{ color: 'green', fontSize: '0.9rem', marginBottom: '10px' }}>{daftarSuccess}</p>}

              <div className="modal-actions">
                <button type="button" className="action-button cancel" onClick={() => setShowDaftarModal(false)}>Tutup</button>
                <button type="submit" className="action-button save" disabled={daftarLoading}>
                  {daftarLoading ? 'Mendaftarkan...' : 'Kirim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lupa Password */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0 }}>Reset Password</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Masukkan email Anda untuk menerima link reset password.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="input-group">
                <label htmlFor="resetEmail">Email</label>
                <input
                  type="email"
                  id="resetEmail"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="nama@email.com"
                />
              </div>
              {resetMessage && <p style={{ color: 'green', fontSize: '0.9rem', marginBottom: '10px' }}>{resetMessage}</p>}
              {resetError && <p className="error-message" style={{ marginBottom: '10px' }}>{resetError}</p>}

              <div className="modal-actions">
                <button type="button" className="action-button cancel" onClick={() => setShowResetModal(false)}>Tutup</button>
                <button type="submit" className="action-button save">Kirim Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}