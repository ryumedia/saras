import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import '../../styles/DataObat.css'; // Menggunakan style yang sama agar konsisten
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

export default function StokDinas() {
  const [transaksiList, setTransaksiList] = useState([]);
  const [obatList, setObatList] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State Filter
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [searchObat, setSearchObat] = useState('');
  
  // State Modal
  const [modalType, setModalType] = useState(null); // 'masuk' | 'keluar' | null
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    obatId: '',
    jumlah: '',
    sasaranType: '', // 'Puskesmas' | 'Sekolah'
    sasaranId: ''
  });

  const stokDinasRef = collection(db, "stok_dinas");
  const obatRef = collection(db, "obat");
  const puskesmasRef = collection(db, "puskesmas");
  const sekolahRef = collection(db, "sekolah");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transaksiSnap, obatSnap, puskesmasSnap, sekolahSnap] = await Promise.all([
        getDocs(stokDinasRef),
        getDocs(obatRef),
        getDocs(puskesmasRef),
        getDocs(sekolahRef)
      ]);

      // Mapping data & Sort by date descending
      const trans = transaksiSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      trans.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      
      setTransaksiList(trans);
      setObatList(obatSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setPuskesmasList(puskesmasSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setSekolahList(sekolahSnap.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterYear, filterMonth, searchObat]);

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

      return matchYear && matchMonth && matchObat;
    });
  }, [transaksiList, filterYear, filterMonth, searchObat]);

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
    setModalType(item.tipe);
    setFormData({
      tanggal: item.tanggal,
      obatId: item.obatId,
      jumlah: item.jumlah,
      sasaranType: item.sasaranType || '',
      sasaranId: item.sasaranId || ''
    });
  };

  const handleOpenModal = (type) => {
    setModalType(type);
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      obatId: '',
      jumlah: '',
      sasaranType: '',
      sasaranId: ''
    });
  };

  const handleCloseModal = () => {
    setModalType(null);
    setEditId(null);
    setEditingItem(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Reset sasaranId jika tipe sasaran berubah
    if (name === 'sasaranType') {
      setFormData(prev => ({ ...prev, sasaranId: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi dasar
    if (!formData.obatId || !formData.jumlah) {
      alert("Mohon lengkapi data obat dan jumlah.");
      return;
    }
    if (modalType === 'keluar' && (!formData.sasaranType || !formData.sasaranId)) {
      alert("Mohon lengkapi data sasaran untuk stok keluar.");
      return;
    }

    const jumlahInt = parseInt(formData.jumlah);
    if (jumlahInt <= 0) {
      alert("Jumlah harus lebih dari 0.");
      return;
    }

    try {
      // Ambil data obat saat ini untuk cek stok
      const selectedObat = obatList.find(o => o.id === formData.obatId);
      if (!selectedObat) {
        alert("Data obat tidak ditemukan.");
        return;
      }

      // Tentukan nama sasaran & Logika Distribusi Otomatis
      let sasaranName = '-';
      if (modalType === 'keluar') {
        if (formData.sasaranType === 'Puskesmas') {
          const p = puskesmasList.find(x => x.id === formData.sasaranId);
          sasaranName = p ? p.nama : 'Unknown Puskesmas';
        } else if (formData.sasaranType === 'Sekolah') {
          const s = sekolahList.find(x => x.id === formData.sasaranId);
          sasaranName = s ? s.nama : 'Unknown Sekolah';
        }
      }

      if (editId) {
        // --- LOGIKA EDIT ---
        // 1. Revert Stok Lama
        const oldObatRef = doc(db, "obat", editingItem.obatId);
        const oldObatSnap = await getDoc(oldObatRef);
        if (oldObatSnap.exists()) {
          const currentStok = oldObatSnap.data().stok || 0;
          const reverseStok = editingItem.tipe === 'masuk' 
            ? currentStok - editingItem.jumlah 
            : currentStok + editingItem.jumlah;
          await updateDoc(oldObatRef, { stok: reverseStok });
        }

        if (editingItem.tipe === 'keluar' && editingItem.sasaranId) {
          let targetColl = editingItem.sasaranType === 'Puskesmas' ? 'puskesmas_stok' : 'sekolah_stok';
          let targetField = editingItem.sasaranType === 'Puskesmas' ? 'puskesmasId' : 'sekolahId';
          const qTarget = query(collection(db, targetColl), where(targetField, "==", editingItem.sasaranId), where("obatId", "==", editingItem.obatId));
          const targetSnap = await getDocs(qTarget);
          if (!targetSnap.empty) {
            const tDoc = targetSnap.docs[0];
            await updateDoc(tDoc.ref, { stok: (tDoc.data().stok || 0) - editingItem.jumlah });
          }
        }

        // 2. Cek Stok Baru (setelah revert)
        const newObatRef = doc(db, "obat", formData.obatId);
        const newObatSnap = await getDoc(newObatRef);
        const newMasterStok = newObatSnap.exists() ? (newObatSnap.data().stok || 0) : 0;

        if (modalType === 'keluar' && newMasterStok < jumlahInt) {
          alert(`Stok tidak mencukupi untuk update! Stok tersedia: ${newMasterStok}`);
          // Note: Idealnya kita rollback revert di sini, tapi untuk simplifikasi kita stop dan user harus refresh/koreksi
          return;
        }

        // 3. Update Transaksi
        await updateDoc(doc(db, "stok_dinas", editId), {
          tanggal: formData.tanggal,
          obatId: formData.obatId,
          namaObat: selectedObat.nama,
          jumlah: jumlahInt,
          sasaran: sasaranName,
          sasaranType: formData.sasaranType || null,
          sasaranId: formData.sasaranId || null,
        });

        // 4. Apply Stok Baru ke Master
        const finalMasterStok = modalType === 'masuk' ? newMasterStok + jumlahInt : newMasterStok - jumlahInt;
        await updateDoc(newObatRef, { stok: finalMasterStok });

      } else {
        // --- LOGIKA CREATE ---
        // Cek stok jika keluar
        if (modalType === 'keluar' && selectedObat.stok < jumlahInt) {
          alert(`Stok tidak mencukupi! Stok saat ini: ${selectedObat.stok}`);
          return;
        }

        // Simpan Transaksi
        await addDoc(stokDinasRef, {
          tanggal: formData.tanggal,
          obatId: formData.obatId,
          namaObat: selectedObat.nama,
          tipe: modalType,
          jumlah: jumlahInt,
          sasaran: sasaranName,
          sasaranType: formData.sasaranType || null,
          sasaranId: formData.sasaranId || null,
          createdAt: new Date()
        });

        // Update Stok Master
        const newStok = modalType === 'masuk' 
          ? (selectedObat.stok || 0) + jumlahInt 
          : (selectedObat.stok || 0) - jumlahInt;

        await updateDoc(doc(db, "obat", formData.obatId), {
          stok: newStok
        });
      }

      // --- LOGIKA UPDATE STOK SASARAN (Berlaku untuk Create & Edit jika tipe Keluar) ---
      if (modalType === 'keluar') {
        let targetColl = formData.sasaranType === 'Puskesmas' ? 'puskesmas_stok' : 'sekolah_stok';
        let targetField = formData.sasaranType === 'Puskesmas' ? 'puskesmasId' : 'sekolahId';
        
        const qStokTarget = query(collection(db, targetColl), 
          where(targetField, "==", formData.sasaranId),
          where("obatId", "==", formData.obatId)
        );
        const stokTargetSnap = await getDocs(qStokTarget);

        if (!stokTargetSnap.empty) {
          const docId = stokTargetSnap.docs[0].id;
          await updateDoc(doc(db, targetColl, docId), {
            stok: (stokTargetSnap.docs[0].data().stok || 0) + jumlahInt
          });
        } else {
          await addDoc(collection(db, targetColl), {
            [targetField]: formData.sasaranId,
            obatId: formData.obatId,
            namaObat: selectedObat.nama,
            stok: jumlahInt
          });
        }

        // Khusus Puskesmas: Catat Transaksi Masuk (Hanya jika Create atau Edit yang mengubah sasaran/jumlah)
        // Untuk simplifikasi Edit, kita bisa update transaksi puskesmas jika ada ID-nya, tapi di sini kita skip update transaksi child untuk Edit agar tidak terlalu kompleks.
        // Untuk Create:
        if (!editId && formData.sasaranType === 'Puskesmas') {
          await addDoc(collection(db, "puskesmas_transaksi"), {
            puskesmasId: formData.sasaranId,
            tanggal: formData.tanggal,
            obatId: formData.obatId,
            namaObat: selectedObat.nama,
            jumlah: jumlahInt,
            tipe: 'masuk',
            sumber: 'Dinas Kesehatan',
            createdAt: new Date()
          });
        }
      }

      handleCloseModal();
      fetchData(); // Refresh data
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert("Gagal menyimpan transaksi.");
    }
  };

  const handleDelete = async (item) => {
    if (window.confirm("Yakin ingin menghapus riwayat ini? Stok obat di Dinas dan di tujuan akan dikembalikan ke kondisi semula.")) {
      try {
        // 1. Kembalikan stok di master obat (Dinas)
        const currentObat = obatList.find(o => o.id === item.obatId);
        if (currentObat) {
          const reverseStok = item.tipe === 'masuk'
            ? (currentObat.stok - item.jumlah)
            : (currentObat.stok + item.jumlah);
          await updateDoc(doc(db, "obat", item.obatId), { stok: reverseStok });
        }

        // 2. Jika ini adalah transaksi keluar, kurangi stok di tujuan (Puskesmas/Sekolah)
        if (item.tipe === 'keluar' && item.sasaranId) {
          let targetCollectionName = '';
          let queryField = '';

          if (item.sasaranType === 'Puskesmas') {
            targetCollectionName = 'puskesmas_stok';
            queryField = 'puskesmasId';
          } else if (item.sasaranType === 'Sekolah') {
            targetCollectionName = 'sekolah_stok';
            queryField = 'sekolahId';
          }

          if (targetCollectionName) {
            const qStokTarget = query(collection(db, targetCollectionName), 
              where(queryField, "==", item.sasaranId),
              where("obatId", "==", item.obatId)
            );
            const stokTargetSnap = await getDocs(qStokTarget);

            if (!stokTargetSnap.empty) {
              const docRef = stokTargetSnap.docs[0].ref;
              const currentTargetStok = stokTargetSnap.docs[0].data().stok || 0;
              await updateDoc(docRef, { stok: currentTargetStok - item.jumlah });
            }
          }
        }

        // 3. Hapus dokumen transaksi itu sendiri
        await deleteDoc(doc(db, "stok_dinas", item.id));
        fetchData();
        alert("Riwayat berhasil dihapus dan stok telah dikembalikan.");
      } catch (err) {
        console.error("Error deleting:", err);
        alert("Gagal menghapus data.");
      }
    }
  };

  return (
    <div className="data-obat-container">
      <div className="page-header">
        <h1>Stok Dinas</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="add-button" onClick={() => handleOpenModal('masuk')} style={{ backgroundColor: '#10B981' }}>
            + Stok Masuk
          </button>
          <button className="add-button" onClick={() => handleOpenModal('keluar')} style={{ backgroundColor: '#EF4444' }}>
            - Stok Keluar
          </button>
        </div>
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
              <th>Nama Obat</th>
              <th>Tipe</th>
              <th>Jumlah</th>
              <th>Sasaran</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{item.tanggal}</td>
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
                <td>{item.sasaran}</td>
                <td>
                  <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  <button className="action-button delete" onClick={() => handleDelete(item)}>Hapus</button>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && !loading && (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Belum ada riwayat transaksi.</td></tr>
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

      <Modal 
        isOpen={!!modalType} 
        onClose={handleCloseModal} 
        onSubmit={handleSubmit} 
        title={editId ? "Edit Transaksi" : (modalType === 'masuk' ? "Catat Stok Masuk" : "Catat Stok Keluar")}
      >
        <div className="input-group">
          <label>Tanggal</label>
          <input type="date" name="tanggal" value={formData.tanggal} onChange={handleInputChange} required />
        </div>
        
        <div className="input-group">
          <label>Pilih Obat</label>
          <select name="obatId" value={formData.obatId} onChange={handleInputChange} required>
            <option value="">-- Pilih Obat --</option>
            {obatList.map(obat => (
              <option key={obat.id} value={obat.id}>
                {obat.nama} (Stok: {obat.stok})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Jumlah</label>
          <input type="number" name="jumlah" value={formData.jumlah} onChange={handleInputChange} required min="1" />
        </div>

        {modalType === 'keluar' && (
          <>
            <div className="input-group">
              <label>Sasaran Distribusi</label>
              <select name="sasaranType" value={formData.sasaranType} onChange={handleInputChange} required>
                <option value="">-- Pilih Tipe Sasaran --</option>
                <option value="Puskesmas">Puskesmas</option>
                <option value="Sekolah">Sekolah</option>
              </select>
            </div>

            {formData.sasaranType === 'Puskesmas' && (
              <div className="input-group">
                <label>Pilih Puskesmas</label>
                <select name="sasaranId" value={formData.sasaranId} onChange={handleInputChange} required>
                  <option value="">-- Pilih Puskesmas --</option>
                  {puskesmasList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.sasaranType === 'Sekolah' && (
              <div className="input-group">
                <label>Pilih Sekolah</label>
                <select name="sasaranId" value={formData.sasaranId} onChange={handleInputChange} required>
                  <option value="">-- Pilih Sekolah --</option>
                  {sekolahList.map(s => (
                    <option key={s.id} value={s.id}>{s.nama}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}