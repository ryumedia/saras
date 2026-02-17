import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import '../../styles/DataObat.css';
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

export default function Kadaluarsa() {
  const { currentUserData } = useAuth();
  const [laporanList, setLaporanList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]); // Stok sekolah untuk dropdown
  const [defaultObatId, setDefaultObatId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [editId, setEditId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter State
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');

  // Modal State
  const [isModalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    sekolahId: '',
    tanggalLapor: new Date().toISOString().split('T')[0],
    tanggalKadaluarsa: '',
    obatId: '', // ID dari master obat (disimpan di sekolah_stok)
    jumlah: ''
  });

  // Collections
  const laporanRef = collection(db, "laporan_kadaluarsa");
  const sekolahStokRef = collection(db, "sekolah_stok");

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    if (!currentUserData) return;

    try {
      const { role, relatedId } = currentUserData;
      let qLaporan = laporanRef;
      let qSekolah = collection(db, "sekolah");
      let qPuskesmas = collection(db, "puskesmas");
      let qInventory = sekolahStokRef;

      // Logic Fetch berdasarkan Role
      if (role === 'Admin Sekolah') {
        qLaporan = query(laporanRef, where("sekolahId", "==", relatedId));
        qSekolah = query(collection(db, "sekolah"), where("__name__", "==", relatedId)); // Fetch single doc
        qInventory = query(sekolahStokRef, where("sekolahId", "==", relatedId));
      } else if (role === 'Admin Puskesmas') {
        // Ambil sekolah binaan
        const schoolsSnap = await getDocs(query(collection(db, "sekolah"), where("puskesmasId", "==", relatedId)));
        const schoolIds = schoolsSnap.docs.map(d => d.id);
        
        if (schoolIds.length > 0) {
          qLaporan = query(laporanRef, where("sekolahId", "in", schoolIds));
          qInventory = query(sekolahStokRef, where("sekolahId", "in", schoolIds));
        } else {
          // Tidak ada sekolah, kosongkan data
          setLaporanList([]);
          setSekolahList([]);
          setInventoryList([]);
          setLoading(false);
          return;
        }
        // Set sekolah list untuk filter
        setSekolahList(schoolsSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      } else {
        // Super Admin: Fetch All
        const schoolsSnap = await getDocs(qSekolah);
        setSekolahList(schoolsSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      }

      const [laporanSnap, puskesmasSnap, inventorySnap, defaultObatSnap] = await Promise.all([
        getDocs(qLaporan),
        getDocs(qPuskesmas),
        getDocs(qInventory),
        getDocs(query(collection(db, "obat"), where("isDefault", "==", true)))
      ]);

      // Jika Admin Sekolah, set sekolah list dari query khusus tadi
      if (role === 'Admin Sekolah') {
        const sSnap = await getDocs(qSekolah);
        setSekolahList(sSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      }

      setLaporanList(laporanSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setPuskesmasList(puskesmasSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setInventoryList(inventorySnap.docs.map(d => ({ ...d.data(), id: d.id })));

      if (!defaultObatSnap.empty) {
        setDefaultObatId(defaultObatSnap.docs[0].id);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserData]);

  // Set default filter
  useEffect(() => {
    if (currentUserData) {
      if (currentUserData.role === 'Admin Puskesmas') {
        setFilterPuskesmas(currentUserData.relatedId);
      } else if (currentUserData.role === 'Admin Sekolah') {
        setFilterSekolah(currentUserData.relatedId);
        // Cari puskesmasId dari sekolah ini
        const mySchool = sekolahList.find(s => s.id === currentUserData.relatedId);
        if (mySchool) setFilterPuskesmas(mySchool.puskesmasId);
      }
    }
  }, [currentUserData, sekolahList]);

  // Filter Logic
  const filteredData = useMemo(() => {
    return laporanList.filter(item => {
      const date = new Date(item.tanggalLapor);
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString();

      const matchYear = filterYear ? year === filterYear : true;
      const matchMonth = filterMonth ? month === filterMonth : true;
      const matchSekolah = filterSekolah ? item.sekolahId === filterSekolah : true;
      
      let matchPuskesmas = true;
      if (filterPuskesmas) {
        const school = sekolahList.find(s => s.id === item.sekolahId);
        matchPuskesmas = school ? school.puskesmasId === filterPuskesmas : false;
      }

      return matchYear && matchMonth && matchSekolah && matchPuskesmas;
    });
  }, [laporanList, filterYear, filterMonth, filterSekolah, filterPuskesmas, sekolahList]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Helpers
  const getSekolahName = (id) => {
    const s = sekolahList.find(item => item.id === id);
    return s ? s.nama : '-';
  };

  // Handlers
  const handleOpenModal = () => {
    const initialSekolahId = currentUserData?.role === 'Admin Sekolah' ? currentUserData.relatedId : '';
    let initialObatId = '';

    if (initialSekolahId && defaultObatId) {
      const hasStock = inventoryList.some(inv => inv.sekolahId === initialSekolahId && inv.obatId === defaultObatId);
      if (hasStock) initialObatId = defaultObatId;
    }

    setEditId(null);
    setFormData({
      sekolahId: initialSekolahId,
      tanggalLapor: new Date().toISOString().split('T')[0],
      tanggalKadaluarsa: '',
      obatId: initialObatId,
      jumlah: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setEditingItem(item);
    setFormData({
      sekolahId: item.sekolahId,
      tanggalLapor: item.tanggalLapor,
      tanggalKadaluarsa: item.tanggalKadaluarsa,
      obatId: item.obatId,
      jumlah: item.jumlah
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setEditingItem(null);
  };

  // Auto-select obat default saat Sekolah dipilih (di Modal)
  useEffect(() => {
    if (isModalOpen && !editId && defaultObatId && formData.sekolahId && !formData.obatId) {
      const hasStock = inventoryList.some(inv => inv.sekolahId === formData.sekolahId && inv.obatId === defaultObatId);
      if (hasStock) {
        setFormData(prev => ({ ...prev, obatId: defaultObatId }));
      }
    }
  }, [formData.sekolahId, isModalOpen, defaultObatId, inventoryList, editId, formData.obatId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { sekolahId, obatId, jumlah, tanggalLapor, tanggalKadaluarsa } = formData;
    const jumlahInt = parseInt(jumlah);

    if (!sekolahId || !obatId || !jumlah || !tanggalLapor || !tanggalKadaluarsa) {
      alert("Mohon lengkapi semua data.");
      return;
    }

    // Cari item inventory (sekolah_stok)
    // Note: inventoryList berisi dokumen sekolah_stok. Kita cari yang cocok.
    // obatId di formData adalah ID master obat (karena kita simpan itu di laporan).
    // Tapi di inventoryList, fieldnya juga obatId.
    const invItem = inventoryList.find(inv => inv.sekolahId === sekolahId && inv.obatId === obatId);

    if (!invItem) {
      alert("Data stok obat tidak ditemukan di sekolah ini.");
      return;
    }

    try {
      if (editId) {
        // --- EDIT ---
        // 1. Revert stok lama (Tambah kembali)
        const oldJumlah = parseInt(editingItem.jumlah);
        
        // Cek apakah stok cukup untuk perubahan (Stok saat ini + Stok Lama >= Stok Baru)
        const currentStok = invItem.stok || 0;
        if (currentStok + oldJumlah < jumlahInt) {
          alert(`Stok tidak mencukupi untuk update! Stok tersedia (setelah dikembalikan): ${currentStok + oldJumlah}`);
          return;
        }

        // 2. Update Laporan
        await updateDoc(doc(db, "laporan_kadaluarsa", editId), {
          sekolahId,
          tanggalLapor,
          tanggalKadaluarsa,
          obatId,
          namaObat: invItem.namaObat || invItem.nama, // Ambil nama dari inventory
          jumlah: jumlahInt
        });

        // 3. Update Stok (Revert lama, Kurangi baru)
        // Jika obatId berubah, logicnya lebih kompleks (revert obat lama, kurangi obat baru).
        // Untuk simplifikasi, asumsikan obatId tidak diubah atau handle basic case.
        if (editingItem.obatId === obatId) {
           await updateDoc(doc(db, "sekolah_stok", invItem.id), {
             stok: currentStok + oldJumlah - jumlahInt
           });
        } else {
           // Jika ganti obat, kembalikan stok obat lama
           const oldInvItem = inventoryList.find(inv => inv.sekolahId === editingItem.sekolahId && inv.obatId === editingItem.obatId);
           if (oldInvItem) {
             await updateDoc(doc(db, "sekolah_stok", oldInvItem.id), { stok: (oldInvItem.stok || 0) + oldJumlah });
           }
           // Kurangi stok obat baru
           await updateDoc(doc(db, "sekolah_stok", invItem.id), { stok: currentStok - jumlahInt });
        }

      } else {
        // --- ADD ---
        if (invItem.stok < jumlahInt) {
          alert(`Stok tidak mencukupi! Stok tersedia: ${invItem.stok}`);
          return;
        }

        // 1. Simpan Laporan
        await addDoc(laporanRef, {
          sekolahId,
          tanggalLapor,
          tanggalKadaluarsa,
          obatId,
          namaObat: invItem.namaObat || invItem.nama,
          jumlah: jumlahInt,
          createdAt: new Date()
        });

        // 2. Kurangi Stok Sekolah
        await updateDoc(doc(db, "sekolah_stok", invItem.id), {
          stok: invItem.stok - jumlahInt
        });
      }

      handleCloseModal();
      fetchData(); // Refresh
    } catch (err) {
      console.error("Error saving data:", err);
      alert("Gagal menyimpan data.");
    }
  };

  const handleDelete = async (item) => {
    if (window.confirm("Yakin ingin menghapus laporan ini? Stok akan dikembalikan ke sekolah.")) {
      try {
        // 1. Kembalikan stok
        const invItem = inventoryList.find(inv => inv.sekolahId === item.sekolahId && inv.obatId === item.obatId);
        if (invItem) {
          await updateDoc(doc(db, "sekolah_stok", invItem.id), {
            stok: (invItem.stok || 0) + parseInt(item.jumlah)
          });
        }

        // 2. Hapus laporan
        await deleteDoc(doc(db, "laporan_kadaluarsa", item.id));
        fetchData();
      } catch (err) {
        console.error("Error deleting:", err);
        alert("Gagal menghapus data.");
      }
    }
  };

  // Dropdown Obat Options (Filtered by selected Sekolah)
  const obatOptions = useMemo(() => {
    if (!formData.sekolahId) return [];
    return inventoryList.filter(inv => inv.sekolahId === formData.sekolahId);
  }, [inventoryList, formData.sekolahId]);

  return (
    <div className="data-obat-container">
      <div className="page-header">
        <h1>Laporan Obat Kadaluarsa</h1>
        <button className="add-button" onClick={handleOpenModal}>+ Tambah Laporan</button>
      </div>

      {/* Filter Section */}
      <div className="filters" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '120px' }}>
          <option value="">Semua Tahun</option>
          {Array.from(new Set(laporanList.map(i => new Date(i.tanggalLapor).getFullYear()))).sort((a,b)=>b-a).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '120px' }}>
          <option value="">Semua Bulan</option>
          {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>)}
        </select>

        <select 
          value={filterPuskesmas} 
          onChange={e => { setFilterPuskesmas(e.target.value); setFilterSekolah(''); }} 
          disabled={currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: (currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah') ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Puskesmas</option>
          {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>

        <select 
          value={filterSekolah} 
          onChange={e => setFilterSekolah(e.target.value)} 
          disabled={currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: currentUserData?.role === 'Admin Sekolah' ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Sekolah</option>
          {sekolahList
            .filter(s => !filterPuskesmas || s.puskesmasId === filterPuskesmas)
            .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Sekolah</th>
              <th>Tanggal Lapor</th>
              <th>Tanggal Kadaluarsa</th>
              <th>Nama Obat</th>
              <th>Jumlah</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{getSekolahName(item.sekolahId)}</td>
                <td>{item.tanggalLapor}</td>
                <td>{item.tanggalKadaluarsa}</td>
                <td>{item.namaObat}</td>
                <td>{item.jumlah}</td>
                <td>
                  <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  <button className="action-button delete" onClick={() => handleDelete(item)}>Hapus</button>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && !loading && (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Belum ada data laporan.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Prev</button>
        <span style={{ fontSize: '0.9rem' }}>Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Next</button>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Laporan Kadaluarsa" : "Tambah Laporan Kadaluarsa"}>
        <div className="input-group">
          <label>Sekolah</label>
          <select 
            value={formData.sekolahId} 
            onChange={e => setFormData({...formData, sekolahId: e.target.value, obatId: ''})} 
            required
            disabled={currentUserData?.role === 'Admin Sekolah'}
          >
            <option value="">-- Pilih Sekolah --</option>
            {sekolahList
              .filter(s => !currentUserData || currentUserData.role === 'Super Admin' || (currentUserData.role === 'Admin Puskesmas' && s.puskesmasId === currentUserData.relatedId) || s.id === currentUserData.relatedId)
              .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label>Tanggal Laporan</label>
          <input type="date" value={formData.tanggalLapor} onChange={e => setFormData({...formData, tanggalLapor: e.target.value})} required />
        </div>

        <div className="input-group">
          <label>Tanggal Kadaluarsa</label>
          <input type="date" value={formData.tanggalKadaluarsa} onChange={e => setFormData({...formData, tanggalKadaluarsa: e.target.value})} required />
        </div>

        <div className="input-group">
          <label>Pilih Obat (Dari Stok Sekolah)</label>
          <select value={formData.obatId} onChange={e => setFormData({...formData, obatId: e.target.value})} required disabled={!formData.sekolahId}>
            <option value="">-- Pilih Obat --</option>
            {obatOptions.map(inv => (
              <option key={inv.obatId} value={inv.obatId}>
                {inv.namaObat || inv.nama} (Stok: {inv.stok})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Jumlah Kadaluarsa</label>
          <input type="number" min="1" value={formData.jumlah} onChange={e => setFormData({...formData, jumlah: e.target.value})} required />
        </div>
      </Modal>
    </div>
  );
}
