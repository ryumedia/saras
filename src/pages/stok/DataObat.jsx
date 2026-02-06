import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import '../../styles/DataObat.css';
import '../../styles/Modal.css';

// Komponen Modal Lokal (bisa juga dipisah jadi komponen reusable)
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

export default function DataObat() {
  const [obatList, setObatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // State untuk Form
  const [formData, setFormData] = useState({
    nama: '',
    kategori: 'Umum',
    stok: 0,
    satuan: 'Tablet'
  });

  const obatCollectionRef = collection(db, "obat");

  // Fungsi Ambil Data (Read)
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getDocs(obatCollectionRef);
      setObatList(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) {
      console.error("Error fetching obat:", err);
      alert("Gagal mengambil data obat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handler Modal
  const handleOpenModal = () => {
    setEditId(null);
    setFormData({ nama: '', kategori: 'Umum', stok: 0, satuan: 'Tablet' });
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setFormData({
      nama: item.nama,
      kategori: item.kategori,
      stok: item.stok,
      satuan: item.satuan
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'stok' ? parseInt(value) || 0 : value 
    }));
  };

  // Fungsi Simpan (Create & Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await updateDoc(doc(db, "obat", editId), formData);
      } else {
        await addDoc(obatCollectionRef, formData);
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error("Error saving obat:", err);
      alert("Gagal menyimpan data.");
    }
  };

  // Fungsi Hapus (Delete)
  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus obat ini?")) {
      try {
        await deleteDoc(doc(db, "obat", id));
        fetchData();
      } catch (err) {
        console.error("Error deleting obat:", err);
        alert("Gagal menghapus data.");
      }
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = obatList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(obatList.length / itemsPerPage);

  return (
    <div className="data-obat-container">
      <div className="page-header">
        <h1>Data Obat</h1>
        <button className="add-button" onClick={handleOpenModal}>Tambah Obat</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Obat</th>
              <th>Kategori</th>
              <th>Stok</th>
              <th>Satuan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{item.nama}</td>
                <td>{item.kategori}</td>
                <td>{item.stok}</td>
                <td>{item.satuan}</td>
                <td>
                  <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  <button className="action-button delete" onClick={() => handleDelete(item.id)}>Hapus</button>
                </td>
              </tr>
            ))}
            {obatList.length === 0 && !loading && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Belum ada data obat.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Prev</button>
        <span style={{ fontSize: '0.9rem' }}>Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Next</button>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Obat" : "Tambah Obat Baru"}>
        <div className="input-group">
          <label>Nama Obat</label>
          <input type="text" name="nama" value={formData.nama} onChange={handleInputChange} required placeholder="Contoh: Paracetamol" />
        </div>
        <div className="input-group">
          <label>Kategori</label>
          <select name="kategori" value={formData.kategori} onChange={handleInputChange}>
            <option value="Umum">Umum</option>
            <option value="Keras">Keras</option>
            <option value="Bebas">Bebas</option>
            <option value="Resep Dokter">Resep Dokter</option>
            <option value="Vitamin">Vitamin</option>
          </select>
        </div>
        <div className="input-group">
          <label>Stok Awal</label>
          <input type="number" name="stok" value={formData.stok} onChange={handleInputChange} required min="0" />
        </div>
        <div className="input-group">
          <label>Satuan</label>
          <select name="satuan" value={formData.satuan} onChange={handleInputChange}>
            <option value="Tablet">Tablet</option>
            <option value="Kapsul">Kapsul</option>
            <option value="Botol">Botol</option>
            <option value="Strip">Strip</option>
            <option value="Box">Box</option>
            <option value="Pcs">Pcs</option>
            <option value="Tube">Tube</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}