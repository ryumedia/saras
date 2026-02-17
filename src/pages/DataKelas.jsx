import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { Edit, Trash2, Plus } from 'lucide-react';
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

export default function DataKelas() {
  const { currentUserData } = useAuth();
  const [kelasList, setKelasList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formData, setFormData] = useState({
    sekolahId: '',
    rombel: '7',
    namaKelas: ''
  });

  useEffect(() => {
    if (!currentUserData) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Ambil Data Sekolah
        const sekolahCol = collection(db, "sekolah");
        const sekolahSnap = await getDocs(sekolahCol);
        const sekolahData = sekolahSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSekolahList(sekolahData);

        // 2. Ambil Data Kelas
        let qKelas = collection(db, "kelas");
        // Jika Admin Sekolah, filter hanya kelas di sekolahnya
        if (currentUserData.role === 'Admin Sekolah') {
          qKelas = query(collection(db, "kelas"), where("sekolahId", "==", currentUserData.relatedId));
        }
        
        const kelasSnap = await getDocs(qKelas);
        const kelasData = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sorting: Sekolah -> Rombel -> Nama Kelas
        kelasData.sort((a, b) => {
            if (a.sekolahId !== b.sekolahId) return a.sekolahId.localeCompare(b.sekolahId);
            if (a.rombel !== b.rombel) return parseInt(a.rombel) - parseInt(b.rombel);
            return a.namaKelas.localeCompare(b.namaKelas);
        });

        setKelasList(kelasData);
      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Gagal mengambil data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUserData]);

  const handleOpenModal = (kelas = null) => {
    if (kelas) {
      setIsEdit(true);
      setCurrentId(kelas.id);
      setFormData({
        sekolahId: kelas.sekolahId,
        rombel: kelas.rombel,
        namaKelas: kelas.namaKelas
      });
    } else {
      setIsEdit(false);
      setCurrentId(null);
      setFormData({
        // Jika Admin Sekolah, otomatis isi sekolahId dan kunci
        sekolahId: currentUserData?.role === 'Admin Sekolah' ? currentUserData.relatedId : '',
        rombel: '7',
        namaKelas: ''
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData({ sekolahId: '', rombel: '7', namaKelas: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sekolahId || !formData.rombel || !formData.namaKelas) {
      alert("Mohon lengkapi semua data.");
      return;
    }

    try {
      const payload = {
        sekolahId: formData.sekolahId,
        rombel: formData.rombel,
        namaKelas: formData.namaKelas
      };

      if (isEdit) {
        await updateDoc(doc(db, "kelas", currentId), payload);
        setKelasList(prev => prev.map(item => item.id === currentId ? { ...item, ...payload } : item));
      } else {
        const docRef = await addDoc(collection(db, "kelas"), payload);
        setKelasList(prev => [...prev, { id: docRef.id, ...payload }]);
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Gagal menyimpan data.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus kelas ini?")) {
      try {
        await deleteDoc(doc(db, "kelas", id));
        setKelasList(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error("Error deleting data:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const getNamaSekolah = (id) => {
    const sekolah = sekolahList.find(s => s.id === id);
    return sekolah ? sekolah.nama : '-';
  };

  if (loading) {
    return <div className="p-4">Memuat data...</div>;
  }

  if (currentUserData?.role !== 'Super Admin' && currentUserData?.role !== 'Admin Sekolah') {
      return <div className="p-4">Akses Ditolak. Halaman ini hanya untuk Super Admin dan Admin Sekolah.</div>;
  }

  return (
    <div className="data-kelas-container p-4">
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Data Kelas</h1>
        <button 
          className="add-button bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition-colors" 
          onClick={() => handleOpenModal()}
        >
          <Plus size={18} /> Tambah Kelas
        </button>
      </div>

      <div className="table-container overflow-x-auto bg-white rounded-lg shadow">
        <table className="data-table w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="border-b p-3 text-left font-semibold">No</th>
              <th className="border-b p-3 text-left font-semibold">Nama Sekolah</th>
              <th className="border-b p-3 text-left font-semibold">Rombel</th>
              <th className="border-b p-3 text-left font-semibold">Nama Kelas</th>
              <th className="border-b p-3 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {kelasList.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50 border-b last:border-b-0">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{getNamaSekolah(item.sekolahId)}</td>
                <td className="p-3">{item.rombel}</td>
                <td className="p-3">{item.namaKelas}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button 
                      className="action-button edit text-blue-600 hover:text-blue-800 p-1" 
                      onClick={() => handleOpenModal(item)}
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      className="action-button delete text-red-600 hover:text-red-800 p-1" 
                      onClick={() => handleDelete(item.id)}
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {kelasList.length === 0 && (
              <tr>
                <td colSpan="5" className="p-6 text-center text-gray-500">Belum ada data kelas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSubmit={handleSubmit} 
        title={isEdit ? "Edit Kelas" : "Tambah Kelas Baru"}
      >
        <div className="input-group mb-4">
          <label className="block mb-1 font-medium text-gray-700">Sekolah</label>
          <select 
            name="sekolahId" 
            value={formData.sekolahId} 
            onChange={(e) => setFormData({...formData, sekolahId: e.target.value})}
            required
            disabled={currentUserData?.role === 'Admin Sekolah'}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">-- Pilih Sekolah --</option>
            {sekolahList.map(s => (
              <option key={s.id} value={s.id}>{s.nama}</option>
            ))}
          </select>
        </div>
        
        <div className="input-group mb-4">
          <label className="block mb-1 font-medium text-gray-700">Rombel</label>
          <select 
            name="rombel" 
            value={formData.rombel} 
            onChange={(e) => setFormData({...formData, rombel: e.target.value})}
            required
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[7, 8, 9, 10, 11, 12].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        
        <div className="input-group mb-4">
          <label className="block mb-1 font-medium text-gray-700">Nama Kelas</label>
          <input 
            type="text" 
            name="namaKelas" 
            value={formData.namaKelas} 
            onChange={(e) => setFormData({...formData, namaKelas: e.target.value})}
            required
            placeholder="Contoh: 7A, 8 Unggulan"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </Modal>
    </div>
  );
}
