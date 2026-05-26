import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase'; // Ensure db is imported
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Import updateDoc
import { User, LogOut, Lock, Phone, Mail, School, Award, BookOpen, Shield, MapPin, Calendar, Activity, Edit } from 'lucide-react'; // Import Edit icon
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
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editProfileFormData, setEditProfileFormData] = useState({});
  const [loadingEditProfile, setLoadingEditProfile] = useState(false);

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

  const handleOpenEditProfileModal = () => {
    setEditProfileFormData({
      nama: currentUserData.nama || '',
      wa: currentUserData.wa || '',
      tempatLahir: currentUserData.tempatLahir || '',
      tanggalLahir: currentUserData.tanggalLahir || '',
      alamat: currentUserData.alamat || '',
      desa: currentUserData.desa || '',
      kecamatan: currentUserData.kecamatan || '',
      photoURL: currentUserData.photoURL || '',
    });
    setIsEditProfileModalOpen(true);
  };

  const handleCloseEditProfileModal = () => {
    setIsEditProfileModalOpen(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Batasi ukuran file (misal 500KB) agar tidak melebihi limit dokumen Firestore (1MB)
      if (file.size > 512000) {
        alert("Ukuran file terlalu besar. Maksimal 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditProfileFormData(prev => ({ ...prev, photoURL: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProfileInputChange = (e) => {
    const { name, value } = e.target;
    setEditProfileFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoadingEditProfile(true);
    try {
      if (!currentUser || !currentUser.uid) {
        alert("User not logged in.");
        return;
      }
      const userDocRef = doc(db, "siswa", currentUser.uid);
      await updateDoc(userDocRef, editProfileFormData);
      alert("Profil berhasil diperbarui!");
      handleCloseEditProfileModal();
      // Assuming AuthContext will re-fetch currentUserData on its own or on next page load
      // For immediate update, you might need to call a context function to refresh user data
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Gagal memperbarui profil: " + error.message);
    } finally {
      setLoadingEditProfile(false);
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
              {currentUserData.photoURL ? (
                <img 
                  src={currentUserData.photoURL} 
                  alt="Avatar" 
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                />
              ) : (
                <div className="avatar-placeholder">
                  <User size={40} />
                </div>
              )}
            </div>
            <div className="profile-info">
              <h2 className="siswa-nama">{currentUserData.nama}</h2>
              <p className="siswa-email">{currentUserData.email}</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                <div className="siswa-poin-badge">
                  <Award size={16} />
                  <span>{currentUserData.poin || 0} Poin</span>
                </div>
                <div className="siswa-poin-badge" style={{ cursor: 'pointer' }} onClick={handleOpenEditProfileModal}>
                  <Edit size={16} />
                  <span>Edit Profil</span>
                </div>
                {currentUserData.lastPemeriksaan && (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    padding: '6px 12px', borderRadius: '20px', 
                    backgroundColor: currentUserData.lastPemeriksaan.warna, 
                    color: '#000', fontSize: '0.85rem', fontWeight: '600',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    <Activity size={16} />
                    <span>{currentUserData.lastPemeriksaan.status}</span>
                  </div>
                )}
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
              <div className="info-icon bg-pink-100 text-pink-600">
                <Calendar size={20} />
              </div>
              <div className="info-text">
                <label>Tempat, Tanggal Lahir</label>
                <p>
                  {currentUserData.tempatLahir ? `${currentUserData.tempatLahir}, ` : ''}
                  {currentUserData.tanggalLahir || '-'}
                </p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon bg-gray-100 text-gray-600">
                <MapPin size={20} />
              </div>
              <div className="info-text">
                <label>Alamat</label>
                <p>{currentUserData.alamat || '-'}</p>
                {(currentUserData.desa || currentUserData.kecamatan) && (
                  <p style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                    {currentUserData.desa ? `Desa ${currentUserData.desa}` : ''}
                    {currentUserData.desa && currentUserData.kecamatan ? ', ' : ''}
                    {currentUserData.kecamatan ? `Kec. ${currentUserData.kecamatan}` : ''}
                  </p>
                )}
              </div>
            </div>

            {currentUserData.lastPemeriksaan && (
              <div className="info-item">
                <div className="info-icon bg-red-100 text-red-600">
                  <Activity size={20} />
                </div>
                <div className="info-text">
                  <label>Pemeriksaan HB Terakhir</label>
                  <p>{currentUserData.lastPemeriksaan.kadarHB} <span style={{ fontSize: '0.85em', color: '#666' }}>({currentUserData.lastPemeriksaan.tanggal})</span></p>
                </div>
              </div>
            )}

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

      {/* Modal Edit Profil */}
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={handleCloseEditProfileModal}
        onSubmit={handleSaveProfile}
        title="Edit Profil Siswa"
      >
        <div className="input-group" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 10px' }}>
            {editProfileFormData.photoURL ? (
              <img 
                src={editProfileFormData.photoURL} 
                alt="Preview" 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0d9488' }} 
              />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e5e7eb' }}>
                <User size={40} color="#0d9488" />
              </div>
            )}
          </div>
          <label 
            className="btn-action change-pass" 
            style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto', padding: '8px 16px', fontSize: '0.85rem', gap: '8px' }}
          >
            <Edit size={16} />
            <span>Ubah Foto</span>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
        </div>

        <div className="input-group">
          <label>Nama Lengkap</label>
          <input
            type="text"
            name="nama"
            value={editProfileFormData.nama || ''}
            onChange={handleEditProfileInputChange}
            required
          />
        </div>
        <div className="input-group">
          <label>Nomor WhatsApp (Format: 628...)</label>
          <input
            type="text"
            name="wa"
            value={editProfileFormData.wa || ''}
            onChange={handleEditProfileInputChange}
            placeholder="628..."
            required
          />
        </div>
        <div className="input-group">
          <label>Tempat Lahir</label>
          <input
            type="text"
            name="tempatLahir"
            value={editProfileFormData.tempatLahir || ''}
            onChange={handleEditProfileInputChange}
          />
        </div>
        <div className="input-group">
          <label>Tanggal Lahir</label>
          <input
            type="date"
            name="tanggalLahir"
            value={editProfileFormData.tanggalLahir || ''}
            onChange={handleEditProfileInputChange}
          />
        </div>
        <div className="input-group">
          <label>Alamat (Jalan/Blok, RT/RW)</label>
          <input
            type="text"
            name="alamat"
            value={editProfileFormData.alamat || ''}
            onChange={handleEditProfileInputChange}
          />
        </div>
        <div className="input-group">
          <label>Desa/Kelurahan</label>
          <input type="text" name="desa" value={editProfileFormData.desa || ''} onChange={handleEditProfileInputChange} />
        </div>
        <div className="input-group">
          <label>Kecamatan</label>
          <input type="text" name="kecamatan" value={editProfileFormData.kecamatan || ''} onChange={handleEditProfileInputChange} />
        </div>
        {loadingEditProfile && <p className="text-sm text-gray-500 mt-2">Menyimpan perubahan profil...</p>}
      </Modal>
    </div>
  );
}
