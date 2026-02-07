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
    satuan: 'Tablet',
    isDefault: false
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
    setFormData({ nama: '', kategori: 'Umum', stok: 0, satuan: 'Tablet', isDefault: false });
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setFormData({
      nama: item.nama,
      kategori: item.kategori,
      stok: item.stok,
      satuan: item.satuan,
      isDefault: item.isDefault || false
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const isCheckbox = e.target.type === 'checkbox';
    setFormData(prev => ({ 
      ...prev, 
      [name]: isCheckbox ? e.target.checked : (name === 'stok' ? parseInt(value) || 0 : value)
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
      {/* Inline Styles for Toggle Switch */}
      <style>{`
        .toggle-switch-custom {
          position: relative;
          display: flex;
          align-items: center;
          cursor: pointer;
          width: auto;
          margin-bottom: 5px;
        }
        .toggle-switch-custom input { opacity: 0; width: 0; height: 0; position: absolute; }
        .slider-custom {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          background-color: #ccc;
          border-radius: 34px;
          transition: .4s;
          flex-shrink: 0;
        }
        .slider-custom:before {
          position: absolute;
          content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
          background-color: white; border-radius: 50%; transition: .4s;
        }
        input:checked + .slider-custom { background-color: #0d9488; }
        input:checked + .slider-custom:before { transform: translateX(20px); }
        .toggle-label-custom { margin-left: 12px; font-weight: 500; color: #374151; }
      `}</style>

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
              <th>Status</th>
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
                  {item.isDefault ? (
                    <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85em', fontWeight: '600' }}>Default</span>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-</span>
                  )}
                </td>
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
        <div className="input-group">
          <label style={{ display: 'block', marginBottom: '8px' }}>Status Default</label>
          <label className="toggle-switch-custom">
            <input 
              type="checkbox" 
              name="isDefault" 
              checked={formData.isDefault} 
              onChange={handleInputChange} 
            />
            <span className="slider-custom"></span>
            <span className="toggle-label-custom">Jadikan Obat Default</span>
          </label>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '8px', lineHeight: '1.4' }}>
            Obat default akan otomatis terpilih di menu input stok dan laporan siswa.
          </p>
        </div>
      </Modal>
    </div>
  );
}