import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import '../styles/Sekolah.css';
import '../styles/Modal.css';

// Komponen Modal untuk form tambah/edit (bisa dipisahkan jadi komponen reusable nanti)
const Modal = ({ isOpen, onClose, onSubmit, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit}>
          {children}
          <div className="modal-actions">
            <button type="button" className="action-button cancel" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="action-button save">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Sekolah() {
  const { currentUserData } = useAuth();
  const [dataSekolah, setDataSekolah] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [newSekolah, setNewSekolah] = useState({ 
    nama: '', 
    alamat: '', 
    desa: '', 
    kecamatan: '', 
    kota: '', 
    kepala: '', 
    puskesmasId: '' 
  });
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Referensi ke collection "sekolah" di Firestore.
  // Jika collection belum ada, Firestore akan otomatis membuatnya saat addDoc dipanggil.
  const sekolahCollectionRef = collection(db, "sekolah");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let sekolahQuery = sekolahCollectionRef;

      // Filter data untuk Admin Puskesmas
      if (currentUserData && currentUserData.role === 'Admin Puskesmas') {
        sekolahQuery = query(sekolahCollectionRef, where("puskesmasId", "==", currentUserData.relatedId));
      }

      const [sekolahSnap, puskesmasSnap] = await Promise.all([
        getDocs(sekolahQuery),
        getDocs(collection(db, "puskesmas"))
      ]);

      const filteredData = sekolahSnap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setDataSekolah(filteredData);
      
      setPuskesmasList(puskesmasSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) {
      setError("Gagal mengambil data dari Firestore.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserData]); // Re-fetch saat data user berubah

  const handleOpenModal = () => {
    setEditId(null);
    const initialData = { 
      nama: '', 
      alamat: '', 
      desa: '', 
      kecamatan: '', 
      kota: '', 
      kepala: '', 
      puskesmasId: '' 
    };
    // Otomatis isi puskesmas jika yang login adalah Admin Puskesmas
    if (currentUserData?.role === 'Admin Puskesmas') {
      initialData.puskesmasId = currentUserData.relatedId;
    }
    setNewSekolah(initialData);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setNewSekolah({ 
      nama: '', 
      alamat: '', 
      desa: '', 
      kecamatan: '', 
      kota: '', 
      kepala: '', 
      puskesmasId: '' 
    }); // Reset form
    setEditId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSekolah(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSaveSekolah = async (e) => {
    e.preventDefault();
    if (!newSekolah.nama || !newSekolah.alamat || !newSekolah.kepala || !newSekolah.puskesmasId) {
      alert("Semua field harus diisi!");
      return;
    }
    try {
      if (editId) {
        // Update data
        await updateDoc(doc(db, "sekolah", editId), newSekolah);
      } else {
        // Tambah data baru (Collection otomatis dibuat di sini jika belum ada)
        await addDoc(sekolahCollectionRef, newSekolah);
      }
      handleCloseModal();
      fetchData(); // Refresh data
    } catch (err) {
      alert("Gagal menyimpan data.");
      console.error(err);
    }
  };

  const handleEditSekolah = (item) => {
    setEditId(item.id);
    setNewSekolah({ 
      nama: item.nama, 
      alamat: item.alamat, 
      desa: item.desa || '', 
      kecamatan: item.kecamatan || '', 
      kota: item.kota || '', 
      kepala: item.kepala, 
      puskesmasId: item.puskesmasId || '' 
    });
    setModalOpen(true);
  };

  const handleDeleteSekolah = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      try {
        const sekolahDoc = doc(db, "sekolah", id);
        await deleteDoc(sekolahDoc);
        fetchData(); // Refresh data
      } catch (err) {
        alert("Gagal menghapus data.");
        console.error(err);
      }
    }
  };

  const getPuskesmasName = (id) => {
    const p = puskesmasList.find(item => item.id === id);
    return p ? p.nama : '-';
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dataSekolah.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(dataSekolah.length / itemsPerPage);

  // Tampilkan halaman hanya untuk Super Admin dan Admin Puskesmas
  if (currentUserData && currentUserData.role === 'Admin Sekolah') {
    return (
      <div className="sekolah-container">
        <h1>Akses Ditolak</h1>
        <p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="sekolah-container">
      <div className="page-header">
        <h1>Data Sekolah</h1>
        <button className="add-button" onClick={handleOpenModal}>Tambah Sekolah</button>
      </div>
      
      {loading && <p>Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}
      
      {!loading && !error && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Sekolah</th>
                <th>Alamat</th>
                <th>Desa/Kel</th>
                <th>Kecamatan</th>
                <th>Kota/Kab</th>
                <th>Kepala Sekolah</th>
                <th>Puskesmas Pembina</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td>{item.nama}</td>
                  <td>{item.alamat}</td>
                  <td>{item.desa || '-'}</td>
                  <td>{item.kecamatan || '-'}</td>
                  <td>{item.kota || '-'}</td>
                  <td>{item.kepala}</td>
                  <td>{getPuskesmasName(item.puskesmasId)}</td>
                  <td>
                    <button className="action-button edit" onClick={() => handleEditSekolah(item)}>Edit</button>
                    <button className="action-button delete" onClick={() => handleDeleteSekolah(item.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Prev</button>
        <span style={{ fontSize: '0.9rem' }}>Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Next</button>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSaveSekolah}>
        <h2>{editId ? 'Edit Data Sekolah' : 'Tambah Sekolah Baru'}</h2>
        <div className="input-group">
          <label htmlFor="nama">Nama Sekolah</label>
          <input type="text" id="nama" name="nama" value={newSekolah.nama} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label htmlFor="alamat">Alamat (Jalan/RT/RW)</label>
          <input type="text" id="alamat" name="alamat" value={newSekolah.alamat} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label htmlFor="desa">Desa/Kelurahan</label>
          <input type="text" id="desa" name="desa" value={newSekolah.desa} onChange={handleInputChange} />
        </div>
        <div className="input-group">
          <label htmlFor="kecamatan">Kecamatan</label>
          <input type="text" id="kecamatan" name="kecamatan" value={newSekolah.kecamatan} onChange={handleInputChange} />
        </div>
        <div className="input-group">
          <label htmlFor="kota">Kota/Kabupaten</label>
          <input type="text" id="kota" name="kota" value={newSekolah.kota} onChange={handleInputChange} />
        </div>
        <div className="input-group">
          <label htmlFor="kepala">Kepala Sekolah</label>
          <input type="text" id="kepala" name="kepala" value={newSekolah.kepala} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label htmlFor="puskesmasId">Puskesmas Pembina</label>
          <select 
            id="puskesmasId" 
            name="puskesmasId" 
            value={newSekolah.puskesmasId} 
            onChange={handleInputChange} 
            required 
            disabled={currentUserData?.role === 'Admin Puskesmas'}>
            <option value="">-- Pilih Puskesmas --</option>
            {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
      </Modal>
    </div>
  );
}