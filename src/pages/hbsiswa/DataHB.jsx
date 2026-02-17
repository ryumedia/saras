import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Edit, Trash2, Plus } from 'lucide-react';
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

export default function DataHB() {
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    kadarHB: '',
    status: '',
    warna: '#000000'
  });

  const collectionRef = collection(db, "master_hb");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getDocs(collectionRef);
      const items = data.docs.map(doc => ({ ...doc.data(), id: doc.id }));

      // Urutkan: Anemia Berat -> Sedang -> Ringan -> Normal
      const order = ['anemia berat', 'anemia sedang', 'anemia ringan', 'normal'];
      
      items.sort((a, b) => {
        const statusA = (a.status || '').toLowerCase();
        const statusB = (b.status || '').toLowerCase();
        
        let indexA = order.findIndex(key => statusA.includes(key));
        let indexB = order.findIndex(key => statusB.includes(key));
        
        // Jika status tidak ditemukan dalam list order, taruh di urutan paling bawah (99)
        if (indexA === -1) indexA = 99;
        if (indexB === -1) indexB = 99;
        
        return indexA - indexB;
      });

      setDataList(items);
    } catch (err) {
      console.error("Error fetching data:", err);
      alert("Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = () => {
    setEditId(null);
    setFormData({ kadarHB: '', status: '', warna: '#000000' });
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setFormData({
      kadarHB: item.kadarHB,
      status: item.status,
      warna: item.warna
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
    try {
      if (editId) {
        await updateDoc(doc(db, "master_hb", editId), formData);
      } else {
        await addDoc(collectionRef, formData);
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error("Error saving data:", err);
      alert("Gagal menyimpan data.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus data ini?")) {
      try {
        await deleteDoc(doc(db, "master_hb", id));
        fetchData();
      } catch (err) {
        console.error("Error deleting:", err);
        alert("Gagal menghapus data.");
      }
    }
  };

  return (
    <div className="data-hb-container" style={{ width: '100%', padding: '20px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Data Kategori HB</h1>
        <button 
          className="add-button" 
          onClick={handleOpenModal}
          style={{ backgroundColor: '#0d9488', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Tambah Status
        </button>
      </div>

      <div className="table-container" style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>No</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Kadar HB</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Warna</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center' }}>Memuat data...</td></tr>
            ) : dataList.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center' }}>Belum ada data.</td></tr>
            ) : (
              dataList.map((item, index) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px' }}>{index + 1}</td>
                  <td style={{ padding: '12px 16px' }}>{item.kadarHB}</td>
                  <td style={{ padding: '12px 16px' }}>{item.status}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: item.warna, border: '1px solid #ddd' }}></div>
                      <span>{item.warna}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(item)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}><Edit size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Status HB" : "Tambah Status HB"}>
        <div className="input-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Kadar HB</label>
          <input type="text" name="kadarHB" value={formData.kadarHB} onChange={handleInputChange} required placeholder="Contoh: 12 - 16 g/dL" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
        </div>
        <div className="input-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Status</label>
          <input type="text" name="status" value={formData.status} onChange={handleInputChange} required placeholder="Contoh: Normal" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
        </div>
        <div className="input-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Warna</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input type="color" name="warna" value={formData.warna} onChange={handleInputChange} style={{ width: '50px', height: '40px', padding: '0', border: 'none', cursor: 'pointer' }} />
            <input type="text" name="warna" value={formData.warna} onChange={handleInputChange} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
