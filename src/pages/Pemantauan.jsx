import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import '../styles/Pemantauan.css';

export default function Pemantauan() {
  const [laporanList, setLaporanList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [obatList, setObatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [filterObat, setFilterObat] = useState('');
  const [searchNama, setSearchNama] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, filterSekolah, filterObat, searchNama]);

  useEffect(() => {
    if (obatList.length > 0) {
        const defaultObat = obatList.find(o => o.isDefault);
        if (defaultObat) {
            setFilterObat(defaultObat.id);
        }
    }
  }, [obatList]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [laporanSnap, sekolahSnap, obatSnap] = await Promise.all([
          getDocs(collection(db, "laporan_minum_obat")),
          getDocs(collection(db, "sekolah")),
          getDocs(collection(db, "obat"))
        ]);

        const laporanData = laporanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        laporanData.sort((a, b) => {
          const dateA = a.timestamp ? a.timestamp.toDate() : new Date(a.tanggalLapor);
          const dateB = b.timestamp ? b.timestamp.toDate() : new Date(b.tanggalLapor);
          return dateB - dateA;
        });

        setLaporanList(laporanData);
        setSekolahList(sekolahSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setObatList(obatSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching data:", err);
        alert("Gagal mengambil data pemantauan.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getSekolahName = (id) => {
    const sekolah = sekolahList.find(s => s.id === id);
    return sekolah ? sekolah.nama : 'N/A';
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Yakin ingin menghapus laporan ini? Stok obat siswa akan dikembalikan.`)) {
      try {
        // 1. Kembalikan stok ke siswa (jika data obatId ada)
        if (item.obatId && item.siswaId) {
          const qStok = query(
            collection(db, "siswa_stok"), 
            where("siswaId", "==", item.siswaId),
            where("obatId", "==", item.obatId)
          );
          const stokSnap = await getDocs(qStok);
          
          if (!stokSnap.empty) {
            const stokDoc = stokSnap.docs[0];
            const currentStok = parseInt(stokDoc.data().stok) || 0;
            await updateDoc(stokDoc.ref, {
              stok: currentStok + parseInt(item.jumlah)
            });
          }
        }

        // 2. Hapus dokumen laporan
        await deleteDoc(doc(db, "laporan_minum_obat", item.id));

        // 3. Update state lokal
        setLaporanList(prev => prev.filter(l => l.id !== item.id));
        
      } catch (err) {
        console.error("Error deleting report:", err);
        alert("Gagal menghapus laporan.");
      }
    }
  };

  const filteredData = useMemo(() => {
    return laporanList.filter(item => {
      const matchStartDate = startDate ? item.tanggalLapor >= startDate : true;
      const matchEndDate = endDate ? item.tanggalLapor <= endDate : true;
      const matchSekolah = filterSekolah ? item.sekolahId === filterSekolah : true;
      const matchObat = filterObat ? item.obatId === filterObat : true;
      const matchNama = searchNama ? (item.namaSiswa || '').toLowerCase().includes(searchNama.toLowerCase()) : true;
      return matchStartDate && matchEndDate && matchSekolah && matchObat && matchNama;
    });
  }, [laporanList, startDate, endDate, filterSekolah, filterObat, searchNama]);

  const summary = useMemo(() => {
    // 1. Jumlah Obat
    const totalObat = filteredData.reduce((acc, curr) => acc + (parseInt(curr.jumlah) || 0), 0);
    
    // 2. Jumlah Siswa (Unique)
    const uniqueSiswa = new Set(filteredData.map(item => item.siswaId)).size;

    // 3. Jumlah Pekan
    let weeks = 0;
    if (filteredData.length > 0) {
      let start, end;
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        // Jika tidak ada filter tanggal, ambil dari range data yang ada
        const dates = filteredData.map(d => new Date(d.tanggalLapor));
        start = new Date(Math.min(...dates));
        end = new Date(Math.max(...dates));
      }
      
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 agar inklusif
      weeks = Math.max(1, Math.ceil(diffDays / 7));
    }

    // 4. Jumlah Bulan (Jumlah Pekan / 4)
    const months = weeks / 4;

    // 5. Rata-rata Obat = (Total Obat / Jumlah Siswa) / Jumlah Bulan
    const average = (uniqueSiswa > 0 && months > 0) ? (totalObat / uniqueSiswa) / months : 0;

    // 6. Frekuensi
    let frekuensi = 'Tidak Pernah';
    const roundedAvg = Math.round(average);

    if (average === 0) frekuensi = 'Tidak Pernah';
    else if (roundedAvg === 1) frekuensi = 'Jarang';
    else if (roundedAvg === 2) frekuensi = 'Kadang';
    else if (roundedAvg === 3) frekuensi = 'Sering';
    else if (roundedAvg >= 4) frekuensi = 'Rutin';
    else frekuensi = 'Jarang'; // Fallback untuk nilai desimal kecil > 0

    return { totalObat, uniqueSiswa, weeks, months, average: average.toFixed(1), frekuensi };
  }, [filteredData, startDate, endDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div className="pemantauan-container">
      <div className="page-header">
        <h1>Pemantauan Minum Obat</h1>
      </div>

      {/* Filter Section */}
      <div className="filters">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <select value={filterSekolah} onChange={e => setFilterSekolah(e.target.value)} style={{ minWidth: '180px' }}>
          <option value="">Semua Sekolah</option>
          {sekolahList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
        <select value={filterObat} onChange={e => setFilterObat(e.target.value)} style={{ minWidth: '180px' }}>
          <option value="">Semua Obat</option>
          {obatList.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select>
        <input type="text" placeholder="Cari Nama Siswa..." value={searchNama} onChange={e => setSearchNama(e.target.value)} />
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card blue">
          <h3>Jumlah Obat</h3>
          <div className="value">{summary.totalObat}</div>
          <div className="sub-text">Tablet Diminum</div>
        </div>
        <div className="summary-card green">
          <h3>Jumlah Siswa</h3>
          <div className="value">{summary.uniqueSiswa}</div>
          <div className="sub-text">Siswa Aktif</div>
        </div>
        <div className="summary-card purple">
          <h3>Jumlah Pekan</h3>
          <div className="value">{summary.weeks}</div>
          <div className="sub-text">Minggu Berjalan</div>
        </div>
        <div className="summary-card teal">
          <h3>Jumlah Bulan</h3>
          <div className="value">{summary.months}</div>
          <div className="sub-text">Bulan Berjalan</div>
        </div>
        <div className="summary-card orange">
          <h3>Rata-rata Obat</h3>
          <div className="value">{summary.average}</div>
          <div className="sub-text">Tablet/Siswa/Bulan</div>
        </div>
        <div className="summary-card red">
          <h3>Frekuensi</h3>
          <div className="value" style={{ fontSize: '1.25rem', marginTop: '5px' }}>{summary.frekuensi}</div>
          <div className="sub-text">Tingkat Kepatuhan</div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal Lapor</th>
              <th>Nama Siswa</th>
              <th>Sekolah</th>
              <th>Nama Obat</th>
              <th>Jumlah</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center' }}>Memuat data...</td></tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td>{item.tanggalLapor}</td>
                  <td>{item.namaSiswa}</td>
                  <td>{getSekolahName(item.sekolahId)}</td>
                  <td>{item.namaObat}</td>
                  <td>{item.jumlah}</td>
                  <td>
                    <button 
                      onClick={() => handleDelete(item)}
                      style={{
                        backgroundColor: '#fee2e2', 
                        color: '#dc2626', 
                        border: '1px solid #fecaca', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Tidak ada data yang cocok.</td></tr>
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
    </div>
  );
}