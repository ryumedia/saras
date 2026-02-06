import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
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

export default function StokSekolah() {
  const { currentUserData } = useAuth();
  const [transaksiList, setTransaksiList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]); // Stok milik Sekolah
  const [siswaList, setSiswaList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]); // Untuk Super Admin
  const [puskesmasList, setPuskesmasList] = useState([]); // Untuk Filter Dropdown
  const [loading, setLoading] = useState(true);
  const [sekolahId, setSekolahId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // State Filter
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [searchObat, setSearchObat] = useState('');
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // State Modal
  const [isModalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    sekolahId: '', // Field baru untuk Super Admin
    tanggal: new Date().toISOString().split('T')[0],
    obatId: '',
    jumlahPerSiswa: 1,
    selectedSiswa: [] // Array of IDs
  });

  // Referensi Collection
  const sekolahStokRef = collection(db, "sekolah_stok");
  const sekolahTransaksiRef = collection(db, "sekolah_transaksi");
  const siswaRef = collection(db, "siswa");
  
  // Referensi untuk data masuk (Read Only)
  const stokDinasRef = collection(db, "stok_dinas");
  const puskesmasTransaksiRef = collection(db, "puskesmas_transaksi");

  // 1. Identifikasi Sekolah dari Login
  useEffect(() => {
    if (!currentUserData) return;

    const { role, relatedId } = currentUserData;

    if (role === 'Super Admin') {
      fetchData(null, 'Super Admin');
    } else if (role === 'Admin Sekolah') {
      setSekolahId(relatedId);
      fetchData(relatedId, 'Admin Sekolah');
    } else if (role === 'Admin Puskesmas') {
      fetchData(relatedId, 'Admin Puskesmas');
    } else {
      // Untuk role lain, jangan lakukan apa-apa, biarkan guard di return yang menangani
      setLoading(false);
    }
  }, [currentUserData]);

  // Set default filter berdasarkan role
  useEffect(() => {
    if (currentUserData?.role === 'Admin Sekolah') {
      setFilterSekolah(currentUserData.relatedId);
      // Cari puskesmasId dari data sekolah yang sudah di-fetch
      const school = sekolahList.find(s => s.id === currentUserData.relatedId);
      if (school) setFilterPuskesmas(school.puskesmasId);
    } else if (currentUserData?.role === 'Admin Puskesmas') {
      setFilterPuskesmas(currentUserData.relatedId);
    }
  }, [currentUserData, sekolahList]);

  // Reset halaman ke 1 saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterYear, filterMonth, searchObat, filterPuskesmas, filterSekolah]);

  // 2. Fetch Semua Data (Masuk & Keluar)
  const fetchData = async (id, role) => {
    setLoading(true);
    try {
      let qDinas = stokDinasRef;
      let qPuskesmas = puskesmasTransaksiRef;
      let qSekolahTrans = sekolahTransaksiRef;
      let qInventory = sekolahStokRef;
      let qSiswa = siswaRef;
      
      let fetchedSekolahList = [];

      if (role === 'Super Admin') {
        const schoolsSnap = await getDocs(collection(db, "sekolah"));
        fetchedSekolahList = schoolsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      } else if (role === 'Admin Puskesmas') {
        // Ambil sekolah binaan puskesmas ini
        const qSekolah = query(collection(db, "sekolah"), where("puskesmasId", "==", id));
        const schoolsSnap = await getDocs(qSekolah);
        fetchedSekolahList = schoolsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        
        const schoolIds = fetchedSekolahList.map(s => s.id);
        
        if (schoolIds.length > 0) {
          qDinas = query(stokDinasRef, where("sasaranId", "in", schoolIds));
          qPuskesmas = query(puskesmasTransaksiRef, where("sekolahId", "in", schoolIds));
          qSekolahTrans = query(sekolahTransaksiRef, where("sekolahId", "in", schoolIds));
          qInventory = query(sekolahStokRef, where("sekolahId", "in", schoolIds));
          qSiswa = query(siswaRef, where("sekolahId", "in", schoolIds));
        } else {
          // Tidak ada sekolah binaan
          const puskesmasSnap = await getDocs(collection(db, "puskesmas"));
          setPuskesmasList(puskesmasSnap.docs.map(d => ({ ...d.data(), id: d.id })));
          setSekolahList([]);
          setTransaksiList([]);
          setInventoryList([]);
          setSiswaList([]);
          setLoading(false);
          return;
        }
      } else if (role === 'Admin Sekolah') {
        qDinas = query(stokDinasRef, where("sasaranId", "==", id));
        qPuskesmas = query(puskesmasTransaksiRef, where("sekolahId", "==", id));
        qSekolahTrans = query(sekolahTransaksiRef, where("sekolahId", "==", id));
        qInventory = query(sekolahStokRef, where("sekolahId", "==", id));
        qSiswa = query(siswaRef, where("sekolahId", "==", id));
      }

      const promises = [
        getDocs(qDinas),
        getDocs(qPuskesmas),
        getDocs(qSekolahTrans),
        getDocs(qInventory),
        getDocs(qSiswa)
      ];

      // Selalu ambil data puskesmas untuk mapping nama di filter
      promises.push(getDocs(collection(db, "puskesmas")));

      // Jika Admin Sekolah, ambil data sekolahnya sendiri untuk list
      if (role === 'Admin Sekolah') {
        promises.push(getDoc(doc(db, "sekolah", id)));
      }

      const results = await Promise.all(promises);
      const [snapDinas, snapPuskesmas, snapSekolahTrans, snapInv, snapSiswa, snapPuskesmasList, snapSingleSekolah] = results;

      setPuskesmasList(snapPuskesmasList.docs.map(d => ({ ...d.data(), id: d.id })));

      if (role === 'Super Admin' || role === 'Admin Puskesmas') {
        setSekolahList(fetchedSekolahList);
      } else if (role === 'Admin Sekolah' && snapSingleSekolah.exists()) {
        setSekolahList([{ ...snapSingleSekolah.data(), id: snapSingleSekolah.id }]);
      }

      // Normalisasi Data untuk Tabel
      let combinedData = [];

      // Data dari Dinas
      snapDinas.forEach(doc => {
        const d = doc.data();
        // Filter: Hanya ambil yang sasarannya Sekolah
        if (d.sasaranType === 'Sekolah') {
          combinedData.push({
            id: doc.id,
            tanggal: d.tanggal,
            sekolahId: d.sasaranId, // Simpan ID sekolah untuk display
            namaObat: d.namaObat,
            jumlah: d.jumlah,
            tipe: 'masuk',
            sumber: 'Dinas Kesehatan'
          });
        }
      });

      // Data dari Puskesmas
      snapPuskesmas.forEach(doc => {
        const d = doc.data();
        // Filter: Hanya ambil yang dikirim ke Sekolah (memiliki sekolahId)
        if (d.sekolahId) {
          combinedData.push({
            id: doc.id,
            tanggal: d.tanggal,
            sekolahId: d.sekolahId,
            namaObat: d.namaObat,
            jumlah: d.jumlah,
            tipe: 'masuk',
            sumber: 'Puskesmas' // Bisa diperbaiki jika ada nama puskesmas di data
          });
        }
      });

      // Data Keluar (Distribusi)
      snapSekolahTrans.forEach(doc => {
        const d = doc.data();
        combinedData.push({
          id: doc.id,
          tanggal: d.tanggal,
          sekolahId: d.sekolahId,
          namaObat: d.namaObat,
          jumlah: d.jumlahTotal,
          tipe: 'keluar',
          sumber: 'Distribusi Siswa',
          obatId: d.obatId,
          jumlahPerSiswa: d.jumlahPerSiswa,
          siswaIds: d.siswaIds
        });
      });

      // Sort berdasarkan tanggal (Terbaru diatas)
      combinedData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      setTransaksiList(combinedData);
      setInventoryList(snapInv.docs.map(d => ({ ...d.data(), id: d.id })));
      setSiswaList(snapSiswa.docs.map(d => ({ ...d.data(), id: d.id })));

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
      const matchSekolah = filterSekolah ? item.sekolahId === filterSekolah : true;
      
      // Filter Puskesmas (Cek apakah sekolah dari transaksi ini milik puskesmas yang dipilih)
      let matchPuskesmas = true;
      if (filterPuskesmas) {
        const school = sekolahList.find(s => s.id === item.sekolahId);
        if (school) {
          matchPuskesmas = school.puskesmasId === filterPuskesmas;
        } else {
          // Jika data sekolah tidak ditemukan (misal dihapus), anggap tidak match
          matchPuskesmas = false;
        }
      }

      return matchYear && matchMonth && matchObat && matchSekolah && matchPuskesmas;
    });
  }, [transaksiList, filterYear, filterMonth, searchObat, filterSekolah, filterPuskesmas, sekolahList]);

  const summary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    filteredData.forEach(item => {
      if (item.tipe === 'masuk') masuk += item.jumlah;
      if (item.tipe === 'keluar') keluar += item.jumlah;
    });
    return { masuk, keluar, sisa: masuk - keluar };
  }, [filteredData]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleEdit = (item) => {
    setEditId(item.id);
    setEditingItem(item);
    
    // Cari item inventory yang sesuai untuk mengisi dropdown obat
    const invItem = inventoryList.find(inv => inv.obatId === item.obatId && inv.sekolahId === item.sekolahId);

    setFormData({
      sekolahId: item.sekolahId,
      tanggal: item.tanggal,
      obatId: invItem ? invItem.id : '', 
      jumlahPerSiswa: item.jumlahPerSiswa,
      selectedSiswa: item.siswaIds || []
    });
    setModalOpen(true);
  };

  // Handler Modal
  const handleOpenModal = () => {
    setFormData({
      sekolahId: sekolahId || '',
      tanggal: new Date().toISOString().split('T')[0],
      obatId: '',
      jumlahPerSiswa: 1,
      selectedSiswa: []
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setEditingItem(null);
  };

  // Handler Checkbox Siswa
  const handleToggleSiswa = (id) => {
    setFormData(prev => {
      const isSelected = prev.selectedSiswa.includes(id);
      if (isSelected) {
        return { ...prev, selectedSiswa: prev.selectedSiswa.filter(sid => sid !== id) };
      } else {
        return { ...prev, selectedSiswa: [...prev.selectedSiswa, id] };
      }
    });
  };

  const handleSelectAllSiswa = (e) => {
    if (e.target.checked) {
      setFormData(prev => ({ ...prev, selectedSiswa: siswaList.map(s => s.id) }));
    } else {
      setFormData(prev => ({ ...prev, selectedSiswa: [] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { obatId, jumlahPerSiswa, selectedSiswa, tanggal, sekolahId: formSekolahId } = formData;
    
    const currentSekolahId = sekolahId || formSekolahId;

    if (!currentSekolahId || !obatId || selectedSiswa.length === 0 || jumlahPerSiswa < 1) {
      alert("Mohon lengkapi data: Pilih Sekolah, Obat, minimal 1 siswa, dan jumlah valid.");
      return;
    }

    const selectedObat = inventoryList.find(o => o.id === obatId);
    const totalKeluar = jumlahPerSiswa * selectedSiswa.length;

    if (!selectedObat) {
      alert("Data obat error.");
      return;
    }

    if (!sekolahId && selectedObat.sekolahId !== currentSekolahId) {
      alert("Obat yang dipilih tidak sesuai dengan Sekolah yang dipilih.");
      return;
    }

    if (selectedObat.stok < totalKeluar) {
      alert(`Stok tidak cukup! Butuh: ${totalKeluar}, Tersedia: ${selectedObat.stok}`);
      return;
    }

    try {
      if (editId) {
        // --- LOGIKA EDIT ---
        // 1. Revert Stok Lama
        const qSekolahOld = query(collection(db, "sekolah_stok"),
            where("sekolahId", "==", editingItem.sekolahId),
            where("obatId", "==", editingItem.obatId));
        const sekOldSnap = await getDocs(qSekolahOld);
        if (!sekOldSnap.empty) {
            const sekDoc = sekOldSnap.docs[0];
            await updateDoc(sekDoc.ref, { stok: (sekDoc.data().stok || 0) + editingItem.jumlah });
        }
        
        // 1b. Revert Stok Siswa (Kurangi stok siswa yang sebelumnya menerima)
        const oldSiswaIds = editingItem.siswaIds || [];
        const oldJumlahPerSiswa = editingItem.jumlahPerSiswa;
        
        await Promise.all(oldSiswaIds.map(async (sId) => {
            const qSiswaStok = query(collection(db, "siswa_stok"), 
                where("siswaId", "==", sId), 
                where("obatId", "==", editingItem.obatId));
            const snap = await getDocs(qSiswaStok);
            if (!snap.empty) {
                const docRef = snap.docs[0].ref;
                const current = snap.docs[0].data().stok || 0;
                await updateDoc(docRef, { stok: current - oldJumlahPerSiswa });
            }
        }));

        // 2. Cek Stok Baru (setelah revert)
        const invRef = doc(db, "sekolah_stok", selectedObat.id);
        const invSnap = await getDoc(invRef);
        const currentRealStock = invSnap.exists() ? (invSnap.data().stok || 0) : 0;

        if (currentRealStock < totalKeluar) {
            alert(`Stok tidak mencukupi untuk update! Stok tersedia: ${currentRealStock}`);
            return;
        }

        // 3. Update Transaksi
        await updateDoc(doc(db, "sekolah_transaksi", editId), {
          sekolahId: currentSekolahId,
          tanggal: tanggal,
          obatId: selectedObat.obatId || selectedObat.id,
          namaObat: selectedObat.namaObat || selectedObat.nama,
          jumlahPerSiswa: parseInt(jumlahPerSiswa),
          jumlahTotal: totalKeluar,
          siswaIds: selectedSiswa,
        });

        // 4. Update Stok Baru
        await updateDoc(invRef, { stok: currentRealStock - totalKeluar });

        // 5. Apply Stok Siswa Baru (Tambah stok ke siswa yang dipilih)
        const newJumlahPerSiswa = parseInt(jumlahPerSiswa);
        await Promise.all(selectedSiswa.map(async (sId) => {
            const qSiswaStok = query(collection(db, "siswa_stok"), 
                where("siswaId", "==", sId), 
                where("obatId", "==", selectedObat.obatId || selectedObat.id));
            const snap = await getDocs(qSiswaStok);
            
            if (!snap.empty) {
                const docRef = snap.docs[0].ref;
                const current = snap.docs[0].data().stok || 0;
                await updateDoc(docRef, { stok: current + newJumlahPerSiswa });
            } else {
                await addDoc(collection(db, "siswa_stok"), {
                    siswaId: sId,
                    obatId: selectedObat.obatId || selectedObat.id,
                    namaObat: selectedObat.namaObat || selectedObat.nama,
                    stok: newJumlahPerSiswa,
                    updatedAt: new Date()
                });
            }
        }));

      } else {
        // --- LOGIKA CREATE ---
        // 1. Simpan Transaksi
        await addDoc(sekolahTransaksiRef, {
          sekolahId: currentSekolahId,
          tanggal: tanggal,
          obatId: selectedObat.obatId || selectedObat.id, // ID referensi master
          namaObat: selectedObat.namaObat || selectedObat.nama,
          jumlahPerSiswa: parseInt(jumlahPerSiswa),
          jumlahTotal: totalKeluar,
          siswaIds: selectedSiswa, // Simpan array ID siswa
          tipe: 'keluar',
          createdAt: new Date()
        });

        // 2. Update Stok Sekolah
        await updateDoc(doc(db, "sekolah_stok", selectedObat.id), {
          stok: selectedObat.stok - totalKeluar
        });

        // 3. Tambah Stok ke Siswa (siswa_stok)
        const newJumlahPerSiswa = parseInt(jumlahPerSiswa);
        await Promise.all(selectedSiswa.map(async (sId) => {
            const qSiswaStok = query(collection(db, "siswa_stok"), 
                where("siswaId", "==", sId), 
                where("obatId", "==", selectedObat.obatId || selectedObat.id));
            const snap = await getDocs(qSiswaStok);
            
            if (!snap.empty) {
                const docRef = snap.docs[0].ref;
                const current = snap.docs[0].data().stok || 0;
                await updateDoc(docRef, { stok: current + newJumlahPerSiswa });
            } else {
                await addDoc(collection(db, "siswa_stok"), {
                    siswaId: sId,
                    obatId: selectedObat.obatId || selectedObat.id,
                    namaObat: selectedObat.namaObat || selectedObat.nama,
                    stok: newJumlahPerSiswa,
                    updatedAt: new Date()
                });
            }
        }));
      }

      handleCloseModal();
      fetchData(sekolahId, currentUserData.role); // Refresh dengan konteks yang sama
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert("Gagal menyimpan distribusi.");
    }
  };

  const getSekolahName = (id) => {
    const s = sekolahList.find(item => item.id === id);
    return s ? s.nama : '-';
  };

  // Guard: Tampilkan halaman hanya untuk role yang diizinkan
  if (!currentUserData || (currentUserData.role !== 'Super Admin' && currentUserData.role !== 'Admin Sekolah' && currentUserData.role !== 'Admin Puskesmas')) {
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
        <h1>Stok Sekolah</h1>
        <button className="add-button" onClick={handleOpenModal} style={{ backgroundColor: '#EF4444' }}>
          - Distribusi ke Siswa
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
              {!sekolahId && <th>Nama Sekolah</th>}
              <th>Nama Obat</th>
              <th>Tipe</th>
              <th>Jumlah</th>
              <th>Sumber / Tujuan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{item.tanggal}</td>
                {!sekolahId && <td>{getSekolahName(item.sekolahId)}</td>}
                <td>{item.namaObat}</td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85em',
                    backgroundColor: item.tipe === 'masuk' ? '#D1FAE5' : '#FEE2E2',
                    color: item.tipe === 'masuk' ? '#065F46' : '#991B1B'
                  }}>
                    {item.tipe === 'masuk' ? 'Masuk' : 'Keluar'}
                  </span>
                </td>
                <td>{item.jumlah}</td>
                <td>{item.sumber}</td>
                <td>
                  {item.tipe === 'keluar' && (
                    <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && !loading && (
              <tr><td colSpan={!sekolahId ? "8" : "7"} style={{ textAlign: 'center' }}>Belum ada riwayat stok.</td></tr>
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

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Distribusi Obat" : "Distribusi Obat ke Siswa"}>
        <div className="input-group">
          <label>Tanggal</label>
          <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} required />
        </div>

        {/* Dropdown Pilih Sekolah (Hanya untuk Super Admin) */}
        {!sekolahId && (
          <div className="input-group">
            <label>Pilih Sekolah</label>
            <select value={formData.sekolahId} onChange={e => setFormData({...formData, sekolahId: e.target.value, selectedSiswa: []})} required>
              <option value="">-- Pilih Sekolah --</option>
              {sekolahList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>
        )}

        <div className="input-group">
          <label>Pilih Obat (Stok Tersedia)</label>
          <select value={formData.obatId} onChange={e => setFormData({...formData, obatId: e.target.value})} required>
            <option value="">-- Pilih Obat --</option>
            {inventoryList.filter(item => !sekolahId ? item.sekolahId === formData.sekolahId : true).map(item => (
              <option key={item.id} value={item.id}>
                {item.namaObat || item.nama} (Stok: {item.stok})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Jumlah per Siswa</label>
          <input type="number" min="1" value={formData.jumlahPerSiswa} onChange={e => setFormData({...formData, jumlahPerSiswa: e.target.value})} required />
        </div>

        <div className="input-group">
          <label>Pilih Siswa ({formData.selectedSiswa.length} terpilih)</label>
          <div className="checkbox-list">
            <label className="checkbox-item header">
              <input 
                type="checkbox" 
                onChange={handleSelectAllSiswa}
                checked={siswaList.length > 0 && formData.selectedSiswa.length === siswaList.length}
              />
              <span>Pilih Semua Siswa</span>
            </label>
            {siswaList.filter(s => !sekolahId ? s.sekolahId === formData.sekolahId : true).map(siswa => (
              <div key={siswa.id}>
                <label className="checkbox-item">
                  <input 
                    type="checkbox" 
                    checked={formData.selectedSiswa.includes(siswa.id)}
                    onChange={() => handleToggleSiswa(siswa.id)}
                  />
                  <span>{siswa.nama} <span style={{ color: '#666', fontSize: '0.85em' }}>({siswa.kelas})</span></span>
                </label>
              </div>
            ))}
            {siswaList.length === 0 && <p style={{ color: '#888', fontStyle: 'italic' }}>Belum ada data siswa.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}