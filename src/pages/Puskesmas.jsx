import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import '../styles/Puskesmas.css';
import '../styles/Modal.css';

// Komponen Modal untuk form tambah/edit
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

export default function Puskesmas() {
  const { currentUserData } = useAuth();
  const [dataPuskesmas, setDataPuskesmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [newPuskesmas, setNewPuskesmas] = useState({ nama: '', alamat: '', kepala: '' });
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const puskesmasCollectionRef = collection(db, "puskesmas");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDocs(puskesmasCollectionRef);
      const filteredData = data.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setDataPuskesmas(filteredData);
    } catch (err) {
      setError("Gagal mengambil data dari Firestore.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserData]);

  const handleOpenModal = () => {
    setEditId(null);
    setNewPuskesmas({ nama: '', alamat: '', kepala: '' });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setNewPuskesmas({ nama: '', alamat: '', kepala: '' }); // Reset form
    setEditId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPuskesmas(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSavePuskesmas = async (e) => {
    e.preventDefault();
    if (!newPuskesmas.nama || !newPuskesmas.alamat || !newPuskesmas.kepala) {
      alert("Semua field harus diisi!");
      return;
    }
    try {
      if (editId) {
        await updateDoc(doc(db, "puskesmas", editId), newPuskesmas);
      } else {
        await addDoc(puskesmasCollectionRef, newPuskesmas);
      }
      handleCloseModal();
      fetchData(); // Muat ulang data setelah menambah/edit
    } catch (err) {
      alert("Gagal menyimpan data.");
      console.error(err);
    }
  };

  const handleEditPuskesmas = (item) => {
    setEditId(item.id);
    setNewPuskesmas({ nama: item.nama, alamat: item.alamat, kepala: item.kepala });
    setModalOpen(true);
  };

  const handleDeletePuskesmas = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      try {
        const puskesmasDoc = doc(db, "puskesmas", id);
        await deleteDoc(puskesmasDoc);
        fetchData(); // Muat ulang data setelah menghapus
      } catch (err) {
        alert("Gagal menghapus data.");
        console.error(err);
      }
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dataPuskesmas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(dataPuskesmas.length / itemsPerPage);

  // Tampilkan halaman hanya untuk Super Admin
  if (currentUserData && currentUserData.role !== 'Super Admin') {
    return (
      <div className="puskesmas-container">
        <h1>Akses Ditolak</h1>
        <p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="puskesmas-container">
      <div className="page-header">
        <h1>Data Puskesmas</h1>
        <button className="add-button" onClick={handleOpenModal}>Tambah Puskesmas</button>
      </div>
      
      {loading && <p>Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}
      
      {!loading && !error && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Puskesmas</th>
                <th>Alamat</th>
                <th>Kepala Puskesmas</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td>{item.nama}</td>
                  <td>{item.alamat}</td>
                  <td>{item.kepala}</td>
                  <td>
                    <button className="action-button edit" onClick={() => handleEditPuskesmas(item)}>Edit</button>
                    <button className="action-button delete" onClick={() => handleDeletePuskesmas(item.id)}>Hapus</button>
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

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSavePuskesmas}>
        <h2>{editId ? 'Edit Data Puskesmas' : 'Tambah Puskesmas Baru'}</h2>
        <div className="input-group">
          <label htmlFor="nama">Nama Puskesmas</label>
          <input type="text" id="nama" name="nama" value={newPuskesmas.nama} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label htmlFor="alamat">Alamat</label>
          <input type="text" id="alamat" name="alamat" value={newPuskesmas.alamat} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label htmlFor="kepala">Kepala Puskesmas</label>
          <input type="text" id="kepala" name="kepala" value={newPuskesmas.kepala} onChange={handleInputChange} required />
        </div>
      </Modal>
    </div>
  );
}