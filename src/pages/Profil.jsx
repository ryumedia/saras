import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import '../styles/Profil.css';

export default function Profil() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({
    nama: '',
    email: '',
    role: '',
    instansi: '' // Nama Puskesmas/Sekolah
  });
  
  // State untuk password
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "admins", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            let instansiName = '-';

            // Ambil nama instansi jika ada
            if (data.relatedId) {
              if (data.role === 'Admin Puskesmas') {
                const pDoc = await getDoc(doc(db, "puskesmas", data.relatedId));
                if (pDoc.exists()) instansiName = pDoc.data().nama;
              } else if (data.role === 'Admin Sekolah') {
                const sDoc = await getDoc(doc(db, "sekolah", data.relatedId));
                if (sDoc.exists()) instansiName = sDoc.data().nama;
              }
            }

            setUserData({
              nama: data.nama,
              email: user.email,
              role: data.role,
              instansi: instansiName
            });
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUserData();
  }, []);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    
    try {
      // 1. Update Nama di Firestore
      await updateDoc(doc(db, "admins", user.uid), {
        nama: userData.nama
      });

      // 2. Update Password (Jika diisi)
      if (passwords.new) {
        if (passwords.new !== passwords.confirm) {
          alert("Konfirmasi password baru tidak cocok.");
          return;
        }
        if (!passwords.current) {
          alert("Mohon masukkan password lama untuk keamanan.");
          return;
        }

        // Re-authenticate user sebelum ganti password
        const credential = EmailAuthProvider.credential(user.email, passwords.current);
        await reauthenticateWithCredential(user, credential);
        
        // Update password
        await updatePassword(user, passwords.new);
        
        setPasswords({ current: '', new: '', confirm: '' });
      }

      alert("Profil berhasil diperbarui!");
      // Reload halaman atau fetch ulang data jika perlu, tapi state sudah terupdate
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error.code === 'auth/wrong-password') {
        alert("Password lama salah.");
      } else if (error.code === 'auth/weak-password') {
        alert("Password baru terlalu lemah (minimal 6 karakter).");
      } else {
        alert("Gagal memperbarui profil: " + error.message);
      }
    }
  };

  if (loading) return <div className="profil-container">Memuat data...</div>;

  return (
    <div className="profil-container">
      <div className="page-header">
        <h1>Profil Saya</h1>
      </div>

      <div className="profil-content">
        <div className="profil-card">
          <div className="profil-header-card">
            <div className="avatar-circle">
              {userData.nama.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <h3>{userData.nama}</h3>
              <span className="role-badge">{userData.role}</span>
              {userData.instansi !== '-' && <p className="instansi-text">{userData.instansi}</p>}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profil-form">
            <div className="form-section">
              <h4>Informasi Dasar</h4>
              <div className="input-group">
                <label>Email (Tidak dapat diubah)</label>
                <input type="email" value={userData.email} disabled className="input-disabled" />
              </div>
              <div className="input-group">
                <label>Nama Lengkap</label>
                <input 
                  type="text" 
                  value={userData.nama} 
                  onChange={(e) => setUserData({...userData, nama: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div className="form-section">
              <h4>Ganti Password</h4>
              <p className="hint-text">Kosongkan jika tidak ingin mengubah password.</p>
              
              <div className="input-group">
                <label>Password Lama</label>
                <input 
                  type="password" 
                  name="current"
                  value={passwords.current} 
                  onChange={handlePasswordChange}
                  placeholder="Diperlukan jika mengganti password"
                />
              </div>
              
              <div className="row-group">
                <div className="input-group">
                  <label>Password Baru</label>
                  <input 
                    type="password" 
                    name="new"
                    value={passwords.new} 
                    onChange={handlePasswordChange}
                  />
                </div>
                <div className="input-group">
                  <label>Konfirmasi Password Baru</label>
                  <input 
                    type="password" 
                    name="confirm"
                    value={passwords.confirm} 
                    onChange={handlePasswordChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-button">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
