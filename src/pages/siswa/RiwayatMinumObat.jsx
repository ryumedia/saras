import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Calendar, Pill } from 'lucide-react';
import '../../styles/Riwayat.css';

export default function RiwayatMinumObat() {
  const { currentUser } = useAuth();
  const [riwayat, setRiwayat] = useState([]);
  const [distribusi, setDistribusi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      setLoading(true);
      try {
        // 1. Ambil data laporan minum obat milik siswa yang sedang login
        const qRiwayat = query(
          collection(db, "laporan_minum_obat"),
          where("siswaId", "==", currentUser.uid)
          // Note: Jika ingin sorting by timestamp di Firestore bersamaan dengan where,
          // biasanya perlu Composite Index. Jika error, hapus orderBy dan sort manual di JS.
        );

        // 2. Ambil data distribusi obat (sekolah_transaksi) yang melibatkan siswa ini
        const qDistribusi = query(
          collection(db, "sekolah_transaksi"),
          where("siswaIds", "array-contains", currentUser.uid)
        );

        const [snapRiwayat, snapDistribusi] = await Promise.all([
          getDocs(qRiwayat),
          getDocs(qDistribusi)
        ]);

        const dataRiwayat = snapRiwayat.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort manual (terbaru di atas) untuk menghindari masalah index Firestore
        dataRiwayat.sort((a, b) => {
            const dateA = new Date(a.tanggalLapor);
            const dateB = new Date(b.tanggalLapor);
            // Jika tanggal sama, urutkan berdasarkan waktu input (timestamp)
            if (dateA.getTime() === dateB.getTime() && a.timestamp && b.timestamp) {
                return b.timestamp.toDate() - a.timestamp.toDate();
            }
            return dateB - dateA; // Descending (Terbaru ke Terlama)
        });

        setRiwayat(dataRiwayat);

        const dataDistribusi = snapDistribusi.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setDistribusi(dataDistribusi);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Ambil daftar tahun unik dari data
  const years = useMemo(() => {
    const yearsRiwayat = riwayat.map(item => new Date(item.tanggalLapor).getFullYear());
    const yearsDistribusi = distribusi.map(item => new Date(item.tanggal).getFullYear());
    const uniqueYears = new Set([...yearsRiwayat, ...yearsDistribusi]);
    return Array.from(uniqueYears).sort((a, b) => b - a);
  }, [riwayat, distribusi]);

  // Filter data berdasarkan Bulan dan Tahun
  const filteredRiwayat = useMemo(() => {
    return riwayat.filter(item => {
      const date = new Date(item.tanggalLapor);
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString(); // 1-12

      const matchYear = filterYear ? year === filterYear : true;
      const matchMonth = filterMonth ? month === filterMonth : true;

      return matchYear && matchMonth;
    });
  }, [riwayat, filterYear, filterMonth]);

  const filteredDistribusi = useMemo(() => {
    return distribusi.filter(item => {
      const date = new Date(item.tanggal);
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString();

      const matchYear = filterYear ? year === filterYear : true;
      const matchMonth = filterMonth ? month === filterMonth : true;

      return matchYear && matchMonth;
    });
  }, [distribusi, filterYear, filterMonth]);

  const totalDisalurkan = useMemo(() => {
    return filteredDistribusi.reduce((acc, curr) => acc + (parseInt(curr.jumlahPerSiswa) || 0), 0);
  }, [filteredDistribusi]);

  const totalObat = useMemo(() => {
    return filteredRiwayat.reduce((acc, curr) => acc + (parseInt(curr.jumlah) || 0), 0);
  }, [filteredRiwayat]);


  if (loading) {
    return <div className="p-4 text-center text-gray-500">Memuat riwayat...</div>;
  }

  return (
    <div className="riwayat-page">
      <div className="riwayat-header">
        <h1>Riwayat Minum Obat</h1>
        <p>Catatan kedisiplinan minum obatmu.</p>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <div className="select-wrapper">
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)}
            className="modern-select"
          >
            <option value="">Semua Tahun</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="select-arrow">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
        
        <div className="select-wrapper">
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            className="modern-select"
          >
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
          <div className="select-arrow">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '10px', padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', color: '#1e40af', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Jumlah Obat Disalurkan</span>
        <span style={{ fontSize: '1.1em' }}>{totalDisalurkan} Tablet</span>
      </div>

      <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Total Obat Diminum</span>
        <span style={{ fontSize: '1.1em' }}>{totalObat} Tablet</span>
      </div>

      {filteredRiwayat.length === 0 ? (
        <div className="empty-state">
          <Calendar className="empty-icon" />
          <p>Tidak ada data riwayat.</p>
        </div>
      ) : (
        <div className="history-list">
          {filteredRiwayat.map((item) => (
            <div 
              key={item.id} 
              className="history-item"
            >
              <div className="item-left">
                <div className="item-icon-bg">
                  <Pill className="item-icon" />
                </div>
                <div className="item-info">
                  <p className="item-name">{item.namaObat || 'Obat'}</p>
                  <div className="item-date-wrapper">
                    <Calendar className="date-icon" />
                    <span>{item.tanggalLapor}</span>
                  </div>
                </div>
              </div>
              <div className="item-right">
                <span className="item-quantity">{item.jumlah}</span>
                <span className="item-unit">Pcs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}