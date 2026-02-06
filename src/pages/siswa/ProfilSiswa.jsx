import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { User, LogOut, Lock, Phone, Mail, School, Award, BookOpen, Shield } from 'lucide-react';
import '../../styles/ProfilSiswa.css';
import '../../styles/Modal.css';

const Modal = ({ isOpen, onClose, onSubmit, children, title }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit}>
          <h2>{title}</h2>
          {children}
          <div className="modal-actions">
            <button type="button" className="action-button cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="action-button save">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function ProfilSiswa() {
  const { currentUser, currentUserData } = useAuth();
  const navigate = useNavigate();
  const [sekolahNama, setSekolahNama] = useState('Memuat...');
  const [isModalOpen, setModalOpen] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [loadingPass, setLoadingPass] = useState(false);

  // Ambil nama sekolah berdasarkan ID
  useEffect(() => {
    const fetchSekolah = async () => {
      if (currentUserData?.sekolahId) {
        try {
          const docSnap = await getDoc(doc(db, "sekolah", currentUserData.sekolahId));
          if (docSnap.exists()) {
            setSekolahNama(docSnap.data().nama);
          } else {
            setSekolahNama('Sekolah tidak ditemukan');
          }
        } catch (err) {
          console.error("Error fetching sekolah:", err);
          setSekolahNama('-');
        }
      }
    };
    fetchSekolah();
  }, [currentUserData]);

  const handleLogout = async () => {
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      try {
        await signOut(auth);
        navigate('/login');
      } catch (error) {
        console.error("Gagal logout:", error);
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (passwords.new.length < 6) {
      alert("Password baru minimal 6 karakter.");
      return;
    }

    setLoadingPass(true);
    try {
      // 1. Re-autentikasi user (diperlukan sebelum ubah password)
      const credential = EmailAuthProvider.credential(currentUser.email, passwords.current);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update password
      await updatePassword(currentUser, passwords.new);
      
      alert("Password berhasil diubah!");
      setModalOpen(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error("Error changing password:", error);
      if (error.code === 'auth/wrong-password') {
        alert("Password lama salah.");
      } else {
        alert("Gagal mengubah password. Silakan coba lagi atau login ulang.");
      }
    } finally {
      setLoadingPass(false);
    }
  };

  if (!currentUserData) return <div className="p-4 text-center">Memuat profil...</div>;

  return (
    <div className="profil-page">
      <div className="profil-header-bg"></div>
      
      <div className="profil-content">
        {/* Kartu Identitas Utama */}
        <div className="profil-card main-card">
          <div className="profile-flex">
            <div className="avatar-container">
              <div className="avatar-placeholder">
                <User size={40} />
              </div>
            </div>
            <div className="profile-info">
              <h2 className="siswa-nama">{currentUserData.nama}</h2>
              <p className="siswa-email">{currentUserData.email}</p>
              <div className="siswa-poin-badge">
                <Award size={16} />
                <span>{currentUserData.poin || 0} Poin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Informasi */}
        <div className="profil-section">
          <h3 className="section-title">Data Diri</h3>
          <div className="info-list">
            <div className="info-item">
              <div className="info-icon bg-blue-100 text-blue-600">
                <BookOpen size={20} />
              </div>
              <div className="info-text">
                <label>Kelas</label>
                <p>{currentUserData.kelas}</p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon bg-green-100 text-green-600">
                <School size={20} />
              </div>
              <div className="info-text">
                <label>Sekolah</label>
                <p>{sekolahNama}</p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon bg-purple-100 text-purple-600">
                <Phone size={20} />
              </div>
              <div className="info-text">
                <label>WhatsApp</label>
                <p>{currentUserData.wa || '-'}</p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon bg-orange-100 text-orange-600">
                <Shield size={20} />
              </div>
              <div className="info-text">
                <label>Status</label>
                <p className={`status-text ${currentUserData.status === 'Aktif' ? 'text-green-600' : 'text-red-600'}`}>
                  {currentUserData.status}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Aksi Akun */}
        <div className="profil-section">
          <h3 className="section-title">Pengaturan Akun</h3>
          <div className="action-buttons">
            <button className="btn-action change-pass" onClick={() => setModalOpen(true)}>
              <Lock size={18} />
              <span>Ubah Password</span>
            </button>
            <button className="btn-action logout" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Keluar Aplikasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Ubah Password */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        onSubmit={handleChangePassword} 
        title="Ubah Password"
      >
        <div className="input-group">
          <label>Password Lama</label>
          <input 
            type="password" 
            value={passwords.current} 
            onChange={e => setPasswords({...passwords, current: e.target.value})} 
            required 
            placeholder="Masukkan password saat ini"
          />
        </div>
        <div className="input-group">
          <label>Password Baru</label>
          <input 
            type="password" 
            value={passwords.new} 
            onChange={e => setPasswords({...passwords, new: e.target.value})} 
            required 
            placeholder="Minimal 6 karakter"
          />
        </div>
        <div className="input-group">
          <label>Konfirmasi Password Baru</label>
          <input 
            type="password" 
            value={passwords.confirm} 
            onChange={e => setPasswords({...passwords, confirm: e.target.value})} 
            required 
            placeholder="Ulangi password baru"
          />
        </div>
        {loadingPass && <p className="text-sm text-gray-500 mt-2">Memproses perubahan password...</p>}
      </Modal>
    </div>
  );
}
