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

export default function StokPuskesmas() {
  const { currentUserData } = useAuth();
  const [transaksiList, setTransaksiList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]); // Stok milik Puskesmas ini
  const [sekolahList, setSekolahList] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]); // Untuk Super Admin
  const [loading, setLoading] = useState(true);
  const [puskesmasId, setPuskesmasId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State Filter
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [searchObat, setSearchObat] = useState('');
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  
  // State Modal
  const [isModalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    puskesmasId: '', // Field baru untuk Super Admin
    tanggal: new Date().toISOString().split('T')[0],
    obatId: '',
    jumlah: '',
    sekolahId: ''
  });

  // Referensi Collection
  const transaksiRef = collection(db, "puskesmas_transaksi");
  const inventoryRef = collection(db, "puskesmas_stok");
  const sekolahRef = collection(db, "sekolah");

  // 1. Ambil ID Puskesmas dari User yang Login
  useEffect(() => {
    if (!currentUserData) return;

    const { role, relatedId } = currentUserData;

    if (role === 'Super Admin') {
      fetchData(null); // Null artinya ambil semua data
    } else if (role === 'Admin Puskesmas') {
      setPuskesmasId(relatedId);
      fetchData(relatedId);
    } else {
      // Untuk role lain, jangan lakukan apa-apa, biarkan guard di return yang menangani
      setLoading(false);
    }
  }, [currentUserData]);

  // Set default filter puskesmas jika login sebagai Admin Puskesmas
  useEffect(() => {
    if (puskesmasId) {
      setFilterPuskesmas(puskesmasId);
    }
  }, [puskesmasId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterYear, filterMonth, searchObat, filterPuskesmas]);

  // 2. Fetch Data Stok & Transaksi berdasarkan Puskesmas ID
  const fetchData = async (pId) => {
    setLoading(true);
    try {
      let qTransaksi = transaksiRef;
      let qInventory = inventoryRef;

      // Jika pId ada (Admin Puskesmas), filter. Jika null (Super Admin), ambil semua.
      if (pId) {
        qTransaksi = query(transaksiRef, where("puskesmasId", "==", pId));
        qInventory = query(inventoryRef, where("puskesmasId", "==", pId));
      }
      
      const promises = [
        getDocs(qTransaksi),
        getDocs(qInventory),
        getDocs(sekolahRef)
      ];

      // Jika Super Admin, ambil juga daftar Puskesmas untuk dropdown/mapping nama
      if (!pId) {
        promises.push(getDocs(collection(db, "puskesmas")));
      } else {
        promises.push(getDoc(doc(db, "puskesmas", pId)));
      }

      const results = await Promise.all(promises);
      const [transaksiSnap, inventorySnap, sekolahSnap] = results;

      const trans = transaksiSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      trans.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      setTransaksiList(trans);
      setInventoryList(inventorySnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setSekolahList(sekolahSnap.docs.map(d => ({ ...d.data(), id: d.id })));

      if (!pId && results[3] && results[3].docs) {
        setPuskesmasList(results[3].docs.map(d => ({ ...d.data(), id: d.id })));
      } else if (pId && results[3] && results[3].exists()) {
        // Masukkan single puskesmas ke list agar bisa muncul di dropdown filter (locked)
        const pData = results[3].data();
        setPuskesmasList([{ ...pData, id: results[3].id }]);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Logic Filter & Summary
  const years = useMemo(() => {
    const uniqueYears = new Set(transaksiList.map(item => new Date(item.tanggal).getFullYear()));
    return Array.from(uniqueYears).sort((a, b) => b - a);
  }, [transaksiList]);

  const filteredData = useMemo(() => {
    return transaksiList.filter(item => {
      const date = new Date(item.tanggal);
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString(); // 1-12

      const matchYear = filterYear ? year === filterYear : true;
      const matchMonth = filterMonth ? month === filterMonth : true;
      const matchObat = searchObat ? item.namaObat.toLowerCase().includes(searchObat.toLowerCase()) : true;
      const matchPuskesmas = filterPuskesmas ? item.puskesmasId === filterPuskesmas : true;

      return matchYear && matchMonth && matchObat && matchPuskesmas;
    });
  }, [transaksiList, filterYear, filterMonth, searchObat, filterPuskesmas]);

  const summary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    filteredData.forEach(item => {
      if (item.tipe === 'masuk') masuk += item.jumlah;
      if (item.tipe === 'keluar') keluar += item.jumlah;
    });
    return { masuk, keluar, sisa: masuk - keluar };
  }, [filteredData]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleEdit = (item) => {
    setEditId(item.id);
    setEditingItem(item);
    
    // Cari item inventory yang sesuai untuk mengisi dropdown obat
    // item.obatId adalah ID master obat, kita perlu ID dokumen puskesmas_stok
    const invItem = inventoryList.find(inv => inv.obatId === item.obatId && inv.puskesmasId === item.puskesmasId);

    setFormData({
      puskesmasId: item.puskesmasId,
      tanggal: item.tanggal,
      obatId: invItem ? invItem.id : '', 
      jumlah: item.jumlah,
      sekolahId: item.sekolahId
    });
    setModalOpen(true);
  };

  const handleOpenModal = () => {
    setFormData({
      puskesmasId: puskesmasId || '', // Jika Admin Puskesmas, otomatis terisi
      tanggal: new Date().toISOString().split('T')[0],
      obatId: '',
      jumlah: '',
      sekolahId: ''
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setEditingItem(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Tentukan ID Puskesmas (dari state login atau dari form selection Super Admin)
    const currentPuskesmasId = puskesmasId || formData.puskesmasId;

    if (!currentPuskesmasId || !formData.obatId || !formData.jumlah || !formData.sekolahId) {
      alert("Mohon lengkapi semua data.");
      return;
    }

    const jumlahInt = parseInt(formData.jumlah);
    const selectedObat = inventoryList.find(o => o.id === formData.obatId); // Note: inventoryList ID adalah ID dokumen di puskesmas_stok
    
    // Validasi tambahan: Pastikan obat yang dipilih milik Puskesmas yang sedang diproses (Penting untuk Super Admin)
    // Namun karena inventoryList memuat semua, kita perlu filter di UI atau validasi di sini.
    const selectedSekolah = sekolahList.find(s => s.id === formData.sekolahId);

    if (!selectedObat) {
      alert("Data obat tidak ditemukan.");
      return;
    }

    // Jika Super Admin, pastikan obat yang dipilih sesuai dengan Puskesmas yang dipilih
    if (!puskesmasId && selectedObat.puskesmasId !== currentPuskesmasId) {
       alert("Obat yang dipilih tidak sesuai dengan Puskesmas yang dipilih.");
       return;
    }

    if (selectedObat.stok < jumlahInt) {
      alert(`Stok tidak mencukupi! Stok tersedia: ${selectedObat.stok}`);
      return;
    }

    try {
      if (editId) {
        // --- LOGIKA EDIT ---
        // 1. Revert Stok Lama (Kembalikan stok ke Puskesmas, Tarik dari Sekolah)
        
        // Revert Puskesmas Stock
        const qInvOld = query(collection(db, "puskesmas_stok"), 
            where("puskesmasId", "==", editingItem.puskesmasId),
            where("obatId", "==", editingItem.obatId));
        const invOldSnap = await getDocs(qInvOld);
        if (!invOldSnap.empty) {
            const invDoc = invOldSnap.docs[0];
            await updateDoc(invDoc.ref, { stok: (invDoc.data().stok || 0) + editingItem.jumlah });
        }

        // Revert Sekolah Stock
        const qSekolahOld = query(collection(db, "sekolah_stok"),
            where("sekolahId", "==", editingItem.sekolahId),
            where("obatId", "==", editingItem.obatId));
        const sekOldSnap = await getDocs(qSekolahOld);
        if (!sekOldSnap.empty) {
            const sekDoc = sekOldSnap.docs[0];
            await updateDoc(sekDoc.ref, { stok: (sekDoc.data().stok || 0) - editingItem.jumlah });
        }

        // 2. Apply Stok Baru
        // Ambil stok terkini dari item yang dipilih (setelah revert)
        const invRef = doc(db, "puskesmas_stok", selectedObat.id);
        const invSnap = await getDoc(invRef);
        const currentRealStock = invSnap.exists() ? (invSnap.data().stok || 0) : 0;

        if (currentRealStock < jumlahInt) {
          alert(`Stok tidak mencukupi untuk update! Stok tersedia: ${currentRealStock}`);
          // Note: Idealnya rollback revert, tapi di sini kita return. User harus refresh/koreksi.
          return;
        }

        // Update Transaksi
        await updateDoc(doc(db, "puskesmas_transaksi", editId), {
          puskesmasId: currentPuskesmasId,
          tanggal: formData.tanggal,
          obatId: selectedObat.obatId,
          namaObat: selectedObat.namaObat || selectedObat.nama,
          jumlah: jumlahInt,
          sekolahId: formData.sekolahId,
          namaSekolah: selectedSekolah ? selectedSekolah.nama : 'Unknown',
        });

        // Update Stok Puskesmas Baru
        await updateDoc(invRef, { stok: currentRealStock - jumlahInt });

      } else {
        // --- LOGIKA CREATE ---
        // 1. Simpan Transaksi
        await addDoc(transaksiRef, {
          puskesmasId: currentPuskesmasId,
          tanggal: formData.tanggal,
          obatId: selectedObat.obatId, // ID referensi ke master obat (jika ada)
          namaObat: selectedObat.namaObat || selectedObat.nama,
          jumlah: jumlahInt,
          sekolahId: formData.sekolahId,
          namaSekolah: selectedSekolah ? selectedSekolah.nama : 'Unknown',
          tipe: 'keluar',
          createdAt: new Date()
        });

        // 2. Update Stok Puskesmas (Kurangi)
        await updateDoc(doc(db, "puskesmas_stok", selectedObat.id), {
          stok: selectedObat.stok - jumlahInt
        });
      }

      // 3. Update/Buat Stok di Sekolah Tujuan (Berlaku untuk Create & Edit)
      const qStokSekolah = query(collection(db, "sekolah_stok"),
        where("sekolahId", "==", formData.sekolahId),
        where("obatId", "==", selectedObat.obatId)
      );
      const stokSekolahSnap = await getDocs(qStokSekolah);

      if (!stokSekolahSnap.empty) {
        const docId = stokSekolahSnap.docs[0].id;
        await updateDoc(doc(db, "sekolah_stok", docId), {
          stok: (stokSekolahSnap.docs[0].data().stok || 0) + jumlahInt
        });
      } else {
        await addDoc(collection(db, "sekolah_stok"), {
          sekolahId: formData.sekolahId,
          obatId: selectedObat.obatId,
          namaObat: selectedObat.namaObat || selectedObat.nama,
          stok: jumlahInt
        });
      }

      handleCloseModal();
      fetchData(puskesmasId);
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert("Gagal menyimpan transaksi.");
    }
  };

  const getPuskesmasName = (id) => {
    const p = puskesmasList.find(item => item.id === id);
    return p ? p.nama : '-';
  };

  // Guard: Tampilkan halaman hanya untuk role yang diizinkan
  if (!currentUserData || (currentUserData.role !== 'Super Admin' && currentUserData.role !== 'Admin Puskesmas')) {
    return (
      <div className="data-obat-container">
        <h1>Akses Ditolak</h1>
        <p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="data-obat-container">
      <div className="page-header">
        <h1>Stok Puskesmas</h1>
        <button className="add-button" onClick={handleOpenModal} style={{ backgroundColor: '#EF4444' }}>
          - Stok Keluar
        </button>
      </div>

      {/* Filter Section */}
      <div className="filters" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '120px' }}>
          <option value="">Semua Tahun</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '120px' }}>
          <option value="">Semua Bulan</option>
          <option value="1">Januari</option>
          <option value="2">Februari</option>
          <option value="3">Maret</option>
          <option value="4">April</option>
          <option value="5">Mei</option>
          <option value="6">Juni</option>
          <option value="7">Juli</option>
          <option value="8">Agustus</option>
          <option value="9">September</option>
          <option value="10">Oktober</option>
          <option value="11">November</option>
          <option value="12">Desember</option>
        </select>

        <select 
          value={filterPuskesmas} 
          onChange={e => setFilterPuskesmas(e.target.value)} 
          disabled={!!puskesmasId} // Lock jika Admin Puskesmas
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: puskesmasId ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Puskesmas</option>
          {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>

        <input 
          type="text" 
          placeholder="Cari Nama Obat..." 
          value={searchObat} 
          onChange={e => setSearchObat(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', flex: 1, minWidth: '200px' }}
        />
      </div>

      {/* Summary Cards */}
      <div className="summary-cards" style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, padding: '20px', background: '#D1FAE5', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#065F46', fontSize: '1rem' }}>Jumlah Masuk</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#065F46' }}>{summary.masuk}</p>
        </div>
        <div className="card" style={{ flex: 1, padding: '20px', background: '#FEE2E2', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#991B1B', fontSize: '1rem' }}>Jumlah Keluar</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#991B1B' }}>{summary.keluar}</p>
        </div>
        <div className="card" style={{ flex: 1, padding: '20px', background: '#DBEAFE', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1E40AF', fontSize: '1rem' }}>Selisih / Sisa</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1E40AF' }}>{summary.sisa}</p>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              {!puskesmasId && <th>Nama Puskesmas</th>}
              <th>Nama Obat</th>
              <th>Tipe</th>
              <th>Jumlah</th>
              <th>Sasaran / Sumber</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{item.tanggal}</td>
                {!puskesmasId && <td>{getPuskesmasName(item.puskesmasId)}</td>}
                <td>{item.namaObat}</td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '0.85em',
                    backgroundColor: item.tipe === 'masuk' ? '#D1FAE5' : '#FEE2E2',
                    color: item.tipe === 'masuk' ? '#065F46' : '#991B1B'
                  }}>
                    {item.tipe === 'masuk' ? 'Masuk' : 'Keluar'}
                  </span>
                </td>
                <td>{item.jumlah}</td>
                <td>{item.tipe === 'masuk' ? item.sumber : item.namaSekolah}</td>
                <td>
                  {item.tipe === 'keluar' && (
                    <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && !loading && (
              <tr><td colSpan={!puskesmasId ? "7" : "6"} style={{ textAlign: 'center' }}>Belum ada riwayat pengeluaran stok.</td></tr>
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

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Stok Keluar" : "Catat Stok Keluar ke Sekolah"}>
        <div className="input-group">
          <label>Tanggal</label>
          <input type="date" name="tanggal" value={formData.tanggal} onChange={handleInputChange} required />
        </div>
        
        {/* Dropdown Pilih Puskesmas (Hanya untuk Super Admin) */}
        {!puskesmasId && (
          <div className="input-group">
            <label>Pilih Puskesmas Asal</label>
            <select name="puskesmasId" value={formData.puskesmasId} onChange={handleInputChange} required>
              <option value="">-- Pilih Puskesmas --</option>
              {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
        )}

        <div className="input-group">
          <label>Pilih Obat (Dari Stok Tersedia)</label>
          <select name="obatId" value={formData.obatId} onChange={handleInputChange} required>
            <option value="">-- Pilih Obat --</option>
            {inventoryList.filter(item => !puskesmasId ? item.puskesmasId === formData.puskesmasId : true).map(item => (
              <option key={item.id} value={item.id}>
                {item.namaObat || item.nama} (Stok: {item.stok})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Jumlah</label>
          <input type="number" name="jumlah" value={formData.jumlah} onChange={handleInputChange} required min="1" />
        </div>

        <div className="input-group">
          <label>Sasaran Sekolah</label>
          <select name="sekolahId" value={formData.sekolahId} onChange={handleInputChange} required>
            <option value="">-- Pilih Sekolah --</option>
            {sekolahList.map(s => (
              <option key={s.id} value={s.id}>{s.nama}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}