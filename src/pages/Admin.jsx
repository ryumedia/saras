import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import '../styles/Admin.css';
import '../styles/Modal.css';

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

export default function Admin() {
  const { currentUserData } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    wa: '',
    role: 'Super Admin',
    relatedId: '', // ID Puskesmas atau Sekolah
    password: ''
  });

  const adminsCollectionRef = collection(db, "admins");

  // Fetch Data (Admins, Puskesmas, Sekolah)
  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminSnap, puskesmasSnap, sekolahSnap] = await Promise.all([
        getDocs(adminsCollectionRef),
        getDocs(collection(db, "puskesmas")),
        getDocs(collection(db, "sekolah"))
      ]);

      setAdmins(adminSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setPuskesmasList(puskesmasSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setSekolahList(sekolahSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) {
      console.error("Error fetching data:", err);
      alert("Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserData]);

  const handleOpenModal = () => {
    setEditId(null);
    setFormData({ nama: '', email: '', wa: '', role: 'Super Admin', relatedId: '', password: '' });
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setFormData({
      nama: item.nama,
      email: item.email,
      wa: item.wa,
      role: item.role,
      relatedId: item.relatedId || '',
      password: '' // Password tidak diedit di sini
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validasi WA
    if (!formData.wa.startsWith('62')) {
      alert("Nomor WA harus diawali dengan 62");
      return;
    }

    // Validasi Dropdown Relasi
    if (formData.role === 'Admin Puskesmas' && !formData.relatedId) {
      alert("Silakan pilih Puskesmas");
      return;
    }
    if (formData.role === 'Admin Sekolah' && !formData.relatedId) {
      alert("Silakan pilih Sekolah");
      return;
    }

    try {
      if (editId) {
        // Mode Edit (Hanya update Firestore)
        const updateData = {
          nama: formData.nama,
          wa: formData.wa,
          role: formData.role,
          relatedId: formData.role === 'Super Admin' ? null : formData.relatedId
        };
        // Note: Email tidak diupdate di Auth untuk simplifikasi, hanya di Firestore display
        await updateDoc(doc(db, "admins", editId), updateData);
      } else {
        // Mode Tambah (Create Auth User & Firestore Doc)
        if (!formData.password) {
          alert("Password wajib diisi untuk admin baru");
          return;
        }

        // Gunakan Secondary App agar tidak logout admin saat ini
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const uid = userCredential.user.uid;

        // Simpan data profil ke Firestore dengan ID = UID
        await setDoc(doc(db, "admins", uid), {
          nama: formData.nama,
          email: formData.email,
          wa: formData.wa,
          role: formData.role,
          relatedId: formData.role === 'Super Admin' ? null : formData.relatedId,
          createdAt: new Date()
        });

        // Cleanup secondary app
        await signOut(secondaryAuth);
        deleteApp(secondaryApp);
      }

      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error("Error saving admin:", err);
      alert("Gagal menyimpan data admin: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus admin ini? (User Auth tidak terhapus otomatis)")) {
      try {
        await deleteDoc(doc(db, "admins", id));
        fetchData();
      } catch (err) {
        console.error("Error deleting:", err);
        alert("Gagal menghapus data.");
      }
    }
  };

  // Helper untuk mendapatkan nama instansi
  const getRelatedName = (role, id) => {
    if (!id) return '-';
    if (role === 'Admin Puskesmas') {
      const p = puskesmasList.find(item => item.id === id);
      return p ? p.nama : 'Unknown';
    }
    if (role === 'Admin Sekolah') {
      const s = sekolahList.find(item => item.id === id);
      return s ? s.nama : 'Unknown';
    }
    return '-';
  };
  
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = admins.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(admins.length / itemsPerPage);

  // Tampilkan halaman hanya untuk Super Admin
  if (currentUserData && currentUserData.role !== 'Super Admin') {
    return (
      <div className="admin-container">
        <h1>Akses Ditolak</h1>
        <p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="page-header">
        <h1>Data Admin</h1>
        <button className="add-button" onClick={handleOpenModal}>Tambah Admin</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>Email</th>
              <th>No. WA</th>
              <th>Role</th>
              <th>Nama Puskesmas/Sekolah</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{item.nama}</td>
                <td>{item.email}</td>
                <td>{item.wa}</td>
                <td><span className={`role-badge ${item.role.replace(/\s+/g, '-').toLowerCase()}`}>{item.role}</span></td>
                <td>{getRelatedName(item.role, item.relatedId)}</td>
                <td>
                  <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  <button className="action-button delete" onClick={() => handleDelete(item.id)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Prev</button>
        <span style={{ fontSize: '0.9rem' }}>Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Next</button>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Admin" : "Tambah Admin Baru"}>
        <div className="input-group">
          <label>Nama</label>
          <input type="text" name="nama" value={formData.nama} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={!!editId} />
        </div>
        {!editId && (
          <div className="input-group">
            <label>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
          </div>
        )}
        <div className="input-group">
          <label>No. WA (Format: 628...)</label>
          <input type="text" name="wa" value={formData.wa} onChange={handleInputChange} required placeholder="628123456789" />
        </div>
        <div className="input-group">
          <label>Role</label>
          <select name="role" value={formData.role} onChange={handleInputChange}>
            <option value="Super Admin">Super Admin</option>
            <option value="Admin Puskesmas">Admin Puskesmas</option>
            <option value="Admin Sekolah">Admin Sekolah</option>
          </select>
        </div>

        {formData.role === 'Admin Puskesmas' && (
          <div className="input-group">
            <label>Pilih Puskesmas</label>
            <select name="relatedId" value={formData.relatedId} onChange={handleInputChange} required>
              <option value="">-- Pilih Puskesmas --</option>
              {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
        )}

        {formData.role === 'Admin Sekolah' && (
          <div className="input-group">
            <label>Pilih Sekolah</label>
            <select name="relatedId" value={formData.relatedId} onChange={handleInputChange} required>
              <option value="">-- Pilih Sekolah --</option>
              {sekolahList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>
        )}
      </Modal>
    </div>
  );
}