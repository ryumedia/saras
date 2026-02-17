import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Calendar, Pill, Users, CheckCircle, AlertCircle, Activity, TrendingUp, Smile, Meh, Frown, AlertTriangle, Download, Package, ArrowDownCircle, ArrowUpCircle, Trash2 } from 'lucide-react';
import '../styles/Pemantauan.css'; // Menggunakan style card yang sudah ada
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper untuk mengubah Hex ke RGBA (untuk background transparan)
const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c= '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return hex;
};

export default function Dashboard() {
  const { currentUserData } = useAuth();
  const navigate = useNavigate();

  // State untuk Data Master
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [masterHBList, setMasterHBList] = useState([]);

  // State untuk Data Transaksi
  const [distribusiList, setDistribusiList] = useState([]);
  const [laporanList, setLaporanList] = useState([]);
  const [kadaluarsaList, setKadaluarsaList] = useState([]);
  const [stokMasukList, setStokMasukList] = useState([]);
  const [stokSekolahList, setStokSekolahList] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Filter
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1); // Awal tahun ini
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSiswa, setFilterSiswa] = useState('');

  // Redirect jika bukan admin
  useEffect(() => {
    if (currentUserData) {
      const isAdmin = currentUserData.role && ['Super Admin', 'Admin Puskesmas', 'Admin Sekolah'].includes(currentUserData.role);
      if (!isAdmin) {
        navigate('/app', { replace: true });
      }
    }
  }, [currentUserData, navigate]);

  // Set default filter berdasarkan role
  useEffect(() => {
    if (currentUserData) {
      if (currentUserData.role === 'Admin Puskesmas') {
        setFilterPuskesmas(currentUserData.relatedId);
      } else if (currentUserData.role === 'Admin Sekolah') {
        setFilterSekolah(currentUserData.relatedId);
      }
    }
  }, [currentUserData]);

  // Auto-set filter puskesmas jika admin sekolah login
  useEffect(() => {
    if (currentUserData?.role === 'Admin Sekolah' && sekolahList.length > 0) {
      const mySchool = sekolahList.find(s => s.id === currentUserData.relatedId);
      if (mySchool) {
        setFilterPuskesmas(mySchool.puskesmasId);
      }
    }
  }, [currentUserData, sekolahList]);

  // Fetch Data Master & Transaksi
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Data Master (Puskesmas, Sekolah, Kelas, Siswa)
        // Optimasi: Fetch siswa hanya jika diperlukan atau fetch semua untuk mapping nama
        const [puskesmasSnap, sekolahSnap, kelasSnap, siswaSnap, masterHBSnap] = await Promise.all([
          getDocs(collection(db, "puskesmas")),
          getDocs(collection(db, "sekolah")),
          getDocs(collection(db, "kelas")),
          getDocs(collection(db, "siswa")), // Fetch semua siswa untuk mapping nama & kelas
          getDocs(collection(db, "master_hb"))
        ]);

        setPuskesmasList(puskesmasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSekolahList(sekolahSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setKelasList(kelasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSiswaList(siswaSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const hbItems = masterHBSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const order = ['anemia berat', 'anemia sedang', 'anemia ringan', 'normal'];
        hbItems.sort((a, b) => {
          const statusA = (a.status || '').toLowerCase();
          const statusB = (b.status || '').toLowerCase();
          let indexA = order.findIndex(key => statusA.includes(key));
          let indexB = order.findIndex(key => statusB.includes(key));
          if (indexA === -1) indexA = 99;
          if (indexB === -1) indexB = 99;
          return indexA - indexB;
        });
        setMasterHBList(hbItems);

        // 2. Fetch Data Transaksi (Distribusi & Laporan) berdasarkan Rentang Tanggal
        // Query Distribusi (Sekolah Transaksi)
        const qDistribusi = query(
          collection(db, "sekolah_transaksi"),
          where("tanggal", ">=", startDate),
          where("tanggal", "<=", endDate),
          where("tipe", "==", "keluar") // Hanya yang keluar ke siswa
        );

        // Query Laporan Minum Obat
        const qLaporan = query(
          collection(db, "laporan_minum_obat"),
          where("tanggalLapor", ">=", startDate),
          where("tanggalLapor", "<=", endDate)
        );

        // Query Laporan Kadaluarsa
        const qKadaluarsa = query(
          collection(db, "laporan_kadaluarsa"),
          where("tanggalLapor", ">=", startDate),
          where("tanggalLapor", "<=", endDate)
        );

        // Query Stok Masuk (Dinas -> Sekolah)
        const qStokDinas = query(
          collection(db, "stok_dinas"),
          where("tanggal", ">=", startDate),
          where("tanggal", "<=", endDate),
          where("sasaranType", "==", "Sekolah")
        );

        // Query Stok Masuk (Puskesmas -> Sekolah)
        const qPuskesmasTrans = query(
          collection(db, "puskesmas_transaksi"),
          where("tanggal", ">=", startDate),
          where("tanggal", "<=", endDate),
          where("tipe", "==", "keluar") // Keluar dari Puskesmas = Masuk ke Sekolah
        );

        const [distribusiSnap, laporanSnap, kadaluarsaSnap, stokDinasSnap, puskesmasTransSnap, stokSekolahSnap] = await Promise.all([
          getDocs(qDistribusi),
          getDocs(qLaporan),
          getDocs(qKadaluarsa),
          getDocs(qStokDinas),
          getDocs(qPuskesmasTrans),
          getDocs(collection(db, "sekolah_stok")) // Snapshot sisa stok (tidak difilter tanggal)
        ]);

        setDistribusiList(distribusiSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLaporanList(laporanSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setKadaluarsaList(kadaluarsaSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setStokSekolahList(stokSekolahSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Gabungkan Stok Masuk
        const masukDinas = stokDinasSnap.docs.map(d => ({ id: d.id, ...d.data(), sekolahId: d.data().sasaranId }));
        const masukPuskesmas = puskesmasTransSnap.docs.map(d => ({ id: d.id, ...d.data() })); // field sekolahId sudah ada
        setStokMasukList([...masukDinas, ...masukPuskesmas]);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]); // Re-fetch jika tanggal berubah

  // --- LOGIKA AGREGASI DATA ---

  // 1. Filter Siswa yang Relevan
  const filteredSiswaMap = useMemo(() => {
    const map = {};
    siswaList.forEach(siswa => {
      // Cek Filter
      const school = sekolahList.find(s => s.id === siswa.sekolahId);
      const puskesmasId = school ? school.puskesmasId : '';

      const matchPuskesmas = filterPuskesmas ? puskesmasId === filterPuskesmas : true;
      const matchSekolah = filterSekolah ? siswa.sekolahId === filterSekolah : true;
      // Filter kelas bisa berdasarkan namaKelas (string) atau kelasId
      const matchKelas = filterKelas ? siswa.kelasId === filterKelas : true;
      const matchSiswa = filterSiswa ? siswa.id === filterSiswa : true;

      if (matchPuskesmas && matchSekolah && matchKelas && matchSiswa) {
        map[siswa.id] = siswa;
      }
    });
    return map;
  }, [siswaList, sekolahList, filterPuskesmas, filterSekolah, filterKelas, filterSiswa]);

  // 2. Hitung Statistik Penerimaan Obat (Distribusi)
  const statsPenerimaan = useMemo(() => {
    const studentReceived = {}; // { siswaId: totalObat }

    distribusiList.forEach(item => {
      // Cek apakah transaksi ini relevan dengan filter sekolah/puskesmas (via item.sekolahId)
      // Namun lebih akurat jika kita cek per siswa yang menerima
      if (item.siswaIds && Array.isArray(item.siswaIds)) {
        item.siswaIds.forEach(siswaId => {
          if (filteredSiswaMap[siswaId]) {
            if (!studentReceived[siswaId]) studentReceived[siswaId] = 0;
            studentReceived[siswaId] += (parseInt(item.jumlahPerSiswa) || 0);
          }
        });
      }
    });

    const totalObat = Object.values(studentReceived).reduce((a, b) => a + b, 0);
    const totalSiswa = Object.keys(studentReceived).length;
    const kurang26 = Object.values(studentReceived).filter(val => val < 26).length;
    const lebih26 = Object.values(studentReceived).filter(val => val >= 26).length;

    return { totalObat, totalSiswa, kurang26, lebih26 };
  }, [distribusiList, filteredSiswaMap]);

  // 3. Hitung Statistik Minum Obat (Laporan)
  const statsMinum = useMemo(() => {
    const studentConsumed = {}; // { siswaId: totalObat }

    laporanList.forEach(item => {
      if (filteredSiswaMap[item.siswaId]) {
        if (!studentConsumed[item.siswaId]) studentConsumed[item.siswaId] = 0;
        studentConsumed[item.siswaId] += (parseInt(item.jumlah) || 0);
      }
    });

    const totalObat = Object.values(studentConsumed).reduce((a, b) => a + b, 0);
    const totalSiswa = Object.keys(studentConsumed).length;
    const kurang26 = Object.values(studentConsumed).filter(val => val < 26).length;
    const lebih26 = Object.values(studentConsumed).filter(val => val >= 26).length;

    return { totalObat, totalSiswa, kurang26, lebih26 };
  }, [laporanList, filteredSiswaMap]);

  // 4. Hitung Statistik Anemia
  const statsAnemia = useMemo(() => {
    // Inisialisasi statistik berdasarkan masterHBList
    const stats = masterHBList.map(hb => ({
      ...hb,
      count: 0
    }));

    Object.values(filteredSiswaMap).forEach(siswa => {
      const lastHB = siswa.lastPemeriksaan;
      if (lastHB) {
        // Cari kategori HB yang cocok berdasarkan ID atau Nama Status
        const hbItem = stats.find(s => s.id === lastHB.hbId) || stats.find(s => s.status === lastHB.status);
        if (hbItem) {
          hbItem.count++;
        }
      }
    });
    return stats;
  }, [filteredSiswaMap, masterHBList]);


  // 4. Hitung Jumlah Minggu
  const jumlahMinggu = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return Math.max(0, Math.floor(diffDays / 7));
  }, [startDate, endDate]);

  // 5. Hitung Statistik Stok Obat
  const statsStok = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let kadaluarsa = 0;
    let sisa = 0;

    // Helper untuk cek apakah item termasuk dalam filter Puskesmas/Sekolah/Kelas(ignored for stock)/Siswa(ignored)
    const checkFilter = (itemSekolahId) => {
       if (!itemSekolahId) return false;
       
       // Jika Filter Sekolah Aktif: Cukup cek kesamaan ID Sekolah
       if (filterSekolah) {
         return itemSekolahId === filterSekolah;
       }

       // Jika Filter Sekolah Tidak Aktif: Cek apakah sekolah valid dan sesuai Filter Puskesmas
       const school = sekolahList.find(s => s.id === itemSekolahId);
       if (!school) return false;
       
       const matchPuskesmas = filterPuskesmas ? school.puskesmasId === filterPuskesmas : true;
       return matchPuskesmas;
    };

    // Stok Masuk
    stokMasukList.forEach(item => {
      if (checkFilter(item.sekolahId)) masuk += (parseInt(item.jumlah) || 0);
    });

    // Stok Keluar (Distribusi ke Siswa)
    distribusiList.forEach(item => {
      if (checkFilter(item.sekolahId)) keluar += (parseInt(item.jumlahTotal || item.jumlah) || 0);
    });

    // Stok Kadaluarsa
    kadaluarsaList.forEach(item => {
      if (checkFilter(item.sekolahId)) kadaluarsa += (parseInt(item.jumlah) || 0);
    });

    // Sisa Stok (Snapshot saat ini)
    stokSekolahList.forEach(item => {
      if (checkFilter(item.sekolahId)) sisa += (parseInt(item.stok) || 0);
    });

    return { masuk, keluar, kadaluarsa, sisa };
  }, [stokMasukList, distribusiList, kadaluarsaList, stokSekolahList, sekolahList, filterPuskesmas, filterSekolah]);

  // Helper untuk memilih ikon berdasarkan nama status (fallback jika dinamis)
  const getStatusIcon = (status, color) => {
    const s = status.toLowerCase();
    const style = { opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: color };
    if (s.includes('normal')) return <Smile className="card-icon" size={40} style={style} />;
    if (s.includes('ringan')) return <Meh className="card-icon" size={40} style={style} />;
    if (s.includes('sedang')) return <Frown className="card-icon" size={40} style={style} />;
    if (s.includes('berat')) return <AlertTriangle className="card-icon" size={40} style={style} />;
    return <Activity className="card-icon" size={40} style={style} />;
  };

  // Fungsi Export PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Header Laporan
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('LAPORAN PEMANTAUAN PROGRAM TTD REMAJA PUTRI', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 30);

    // Garis Pembatas
    doc.setDrawColor(200);
    doc.line(14, 35, 196, 35);
    
    // Informasi Filter
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Informasi Filter:', 14, 45);
    
    doc.setFontSize(10);
    doc.setTextColor(50);
    
    const selectedSekolah = sekolahList.find(s => s.id === filterSekolah);
    const getPuskesmasName = () => puskesmasList.find(p => p.id === filterPuskesmas)?.nama || 'Semua Puskesmas';
    const getSekolahName = () => selectedSekolah?.nama || 'Semua Sekolah';
    const getKelasName = () => kelasList.find(k => k.id === filterKelas)?.namaKelas || 'Semua Kelas';
    const getSiswaName = () => siswaList.find(s => s.id === filterSiswa)?.nama || 'Semua Siswa';

    const filterData = [
      [`Rentang Tanggal`, `: ${startDate} s/d ${endDate}`],
      [`Puskesmas`, `: ${getPuskesmasName()}`],
      [`Sekolah`, `: ${getSekolahName()}`],
    ];

    if (selectedSekolah) {
      if (selectedSekolah.desa) filterData.push([`Desa/Kelurahan`, `: ${selectedSekolah.desa}`]);
      if (selectedSekolah.kecamatan) filterData.push([`Kecamatan`, `: ${selectedSekolah.kecamatan}`]);
      if (selectedSekolah.kota) filterData.push([`Kota/Kabupaten`, `: ${selectedSekolah.kota}`]);
    }

    filterData.push([`Kelas`, `: ${getKelasName()}`]);
    filterData.push([`Siswa`, `: ${getSiswaName()}`]);

    let yPos = 52;
    filterData.forEach(([label, value]) => {
      doc.text(label, 14, yPos);
      doc.text(value, 50, yPos);
      yPos += 6;
    });

    // Menyiapkan Data Tabel
    const tableBody = [
        [{ content: 'Rentang Waktu', colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
        ['Jumlah Minggu', `${jumlahMinggu} Minggu`],
        
        [{ content: 'Penerimaan Obat (Distribusi)', colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
        ['Total Obat Diterima', `${statsPenerimaan.totalObat} Tablet`],
        ['Siswa Menerima', `${statsPenerimaan.totalSiswa} Orang`],
        ['Menerima < 26 Tablet', `${statsPenerimaan.kurang26} Siswa`],
        ['Menerima >= 26 Tablet', `${statsPenerimaan.lebih26} Siswa`],

        [{ content: 'Kepatuhan Minum Obat', colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
        ['Total Obat Diminum', `${statsMinum.totalObat} Tablet`],
        ['Siswa Minum Obat', `${statsMinum.totalSiswa} Orang`],
        ['Minum < 26 Tablet', `${statsMinum.kurang26} Siswa`],
        ['Minum >= 26 Tablet', `${statsMinum.lebih26} Siswa`],

        [{ content: 'Status Anemia Siswa', colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
    ];

    statsAnemia.forEach(hb => {
        tableBody.push([hb.status, `${hb.count} Siswa`]);
    });

    // Tambahkan Section Stok Obat ke PDF
    tableBody.push(
        [{ content: 'Stok Obat (Sekolah)', colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
        ['Obat Masuk', `${statsStok.masuk} Tablet`],
        ['Obat Keluar', `${statsStok.keluar} Tablet`],
        ['Obat Kadaluarsa', `${statsStok.kadaluarsa} Tablet`],
        ['Sisa Stok Saat Ini', `${statsStok.sisa} Tablet`]
    );

    autoTable(doc, {
        startY: yPos + 5,
        head: [['Indikator', 'Nilai']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [13, 148, 136] }, // Warna Teal
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
        }
    });

    doc.save(`Laporan_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="dashboard-container" style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937' }}>Dashboard Monitoring</h1>
          <p style={{ color: '#6b7280' }}>Pantau distribusi dan kepatuhan minum obat siswa.</p>
        </div>
        <button 
          onClick={handleDownloadPDF}
          style={{ 
            backgroundColor: '#2563eb', 
            color: 'white', 
            padding: '10px 16px', 
            borderRadius: '8px', 
            border: 'none', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Download size={18} />
          Export PDF
        </button>
      </div>

      {/* --- FILTER SECTION --- */}
      <div className="filters" style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex', 
        gap: '15px', 
        flexWrap: 'wrap',
        marginBottom: '25px',
        alignItems: 'end'
      }}>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '5px', color: '#374151' }}>Tanggal Mulai</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
        </div>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '5px', color: '#374151' }}>Tanggal Selesai</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
        </div>

        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '5px', color: '#374151' }}>Puskesmas</label>
          <select 
            value={filterPuskesmas} 
            onChange={e => { setFilterPuskesmas(e.target.value); setFilterSekolah(''); setFilterKelas(''); setFilterSiswa(''); }} 
            disabled={currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah'}
            style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '200px', backgroundColor: (currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah') ? '#f3f4f6' : 'white' }}
          >
            <option value="">Semua Puskesmas</option>
            {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '5px', color: '#374151' }}>Sekolah</label>
          <select 
            value={filterSekolah} 
            onChange={e => { setFilterSekolah(e.target.value); setFilterKelas(''); setFilterSiswa(''); }} 
            disabled={currentUserData?.role === 'Admin Sekolah'}
            style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '200px', backgroundColor: currentUserData?.role === 'Admin Sekolah' ? '#f3f4f6' : 'white' }}
          >
            <option value="">Semua Sekolah</option>
            {sekolahList
              .filter(s => !filterPuskesmas || s.puskesmasId === filterPuskesmas)
              .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '5px', color: '#374151' }}>Kelas</label>
          <select 
            value={filterKelas} 
            onChange={e => { setFilterKelas(e.target.value); setFilterSiswa(''); }} 
            disabled={!filterSekolah}
            style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '120px' }}
          >
            <option value="">Semua Kelas</option>
            {kelasList
              .filter(k => k.sekolahId === filterSekolah)
              .sort((a, b) => a.namaKelas.localeCompare(b.namaKelas))
              .map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '5px', color: '#374151' }}>Siswa</label>
          <select 
            value={filterSiswa} 
            onChange={e => setFilterSiswa(e.target.value)} 
            disabled={!filterKelas}
            style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '200px' }}
          >
            <option value="">Semua Siswa</option>
            {siswaList
              .filter(s => s.kelasId === filterKelas)
              .sort((a, b) => a.nama.localeCompare(b.nama))
              .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Memuat data dashboard...</div>
      ) : (
        <>
          {/* --- CARD JUMLAH MINGGU --- */}
          <div style={{ marginBottom: '30px' }}>
            <div className="summary-card purple" style={{ maxWidth: '300px' }}>
              <h3>Rentang Waktu</h3>
              <div className="value">{jumlahMinggu}</div>
              <div className="sub-text">Minggu</div>
              <Calendar className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#7c3aed' }} />
            </div>
          </div>

          {/* --- SECTION PENERIMAAN OBAT --- */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px', borderLeft: '4px solid #0d9488', paddingLeft: '10px' }}>
              Penerimaan Obat (Distribusi ke Siswa)
            </h2>
            <div className="summary-cards">
              <div className="summary-card blue">
                <h3>Total Obat Diterima</h3>
                <div className="value">{statsPenerimaan.totalObat}</div>
                <div className="sub-text">Tablet (TTD)</div>
                <Pill className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#2563eb' }} />
              </div>
              <div className="summary-card green">
                <h3>Siswa Menerima</h3>
                <div className="value">{statsPenerimaan.totalSiswa}</div>
                <div className="sub-text">Orang</div>
                <Users className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#059669' }} />
              </div>
              <div className="summary-card orange">
                <h3>Menerima &lt; 26 Tablet</h3>
                <div className="value">{statsPenerimaan.kurang26}</div>
                <div className="sub-text">Siswa</div>
                <AlertCircle className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#d97706' }} />
              </div>
              <div className="summary-card teal">
                <h3>Menerima &ge; 26 Tablet</h3>
                <div className="value">{statsPenerimaan.lebih26}</div>
                <div className="sub-text">Siswa</div>
                <CheckCircle className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#0d9488' }} />
              </div>
            </div>
          </div>

          {/* --- SECTION MINUM OBAT --- */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px', borderLeft: '4px solid #d97706', paddingLeft: '10px' }}>
              Kepatuhan Minum Obat
            </h2>
            <div className="summary-cards">
              <div className="summary-card blue">
                <h3>Total Obat Diminum</h3>
                <div className="value">{statsMinum.totalObat}</div>
                <div className="sub-text">Tablet (TTD)</div>
                <Activity className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#2563eb' }} />
              </div>
              <div className="summary-card green">
                <h3>Siswa Minum Obat</h3>
                <div className="value">{statsMinum.totalSiswa}</div>
                <div className="sub-text">Orang</div>
                <Users className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#059669' }} />
              </div>
              <div className="summary-card red">
                <h3>Minum &lt; 26 Tablet</h3>
                <div className="value">{statsMinum.kurang26}</div>
                <div className="sub-text">Siswa</div>
                <TrendingUp className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', transform: 'scaleY(-1)', color: '#dc2626' }} />
              </div>
              <div className="summary-card teal">
                <h3>Minum &ge; 26 Tablet</h3>
                <div className="value">{statsMinum.lebih26}</div>
                <div className="sub-text">Siswa</div>
                <CheckCircle className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#0d9488' }} />
              </div>
            </div>
          </div>

          {/* --- SECTION STATUS ANEMIA --- */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px', borderLeft: '4px solid #ef4444', paddingLeft: '10px' }}>
              Status Anemia Siswa
            </h2>
            <div className="summary-cards">
              {statsAnemia.map(hb => (
                <div key={hb.id} className="summary-card" style={{ backgroundColor: hexToRgba(hb.warna, 0.15), borderColor: hexToRgba(hb.warna, 0.3) }}>
                  <h3 style={{ color: hb.warna, filter: 'brightness(0.8)' }}>{hb.status}</h3>
                  <div className="value" style={{ color: hb.warna, filter: 'brightness(0.6)' }}>{hb.count}</div>
                  <div className="sub-text">Siswa</div>
                  {getStatusIcon(hb.status, hb.warna)}
                </div>
              ))}
            </div>
          </div>

          {/* --- SECTION STOK OBAT --- */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px', borderLeft: '4px solid #6366f1', paddingLeft: '10px' }}>
              Stok Obat (Sekolah)
            </h2>
            <div className="summary-cards">
              <div className="summary-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <h3 style={{ color: '#047857' }}>Obat Masuk</h3>
                <div className="value" style={{ color: '#047857' }}>{statsStok.masuk}</div>
                <div className="sub-text">Tablet</div>
                <ArrowDownCircle className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#047857' }} />
              </div>
              <div className="summary-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <h3 style={{ color: '#1d4ed8' }}>Obat Keluar</h3>
                <div className="value" style={{ color: '#1d4ed8' }}>{statsStok.keluar}</div>
                <div className="sub-text">Tablet</div>
                <ArrowUpCircle className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#1d4ed8' }} />
              </div>
              <div className="summary-card" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <h3 style={{ color: '#c2410c' }}>Obat Kadaluarsa</h3>
                <div className="value" style={{ color: '#c2410c' }}>{statsStok.kadaluarsa}</div>
                <div className="sub-text">Tablet</div>
                <Trash2 className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#c2410c' }} />
              </div>
              <div className="summary-card" style={{ background: '#f5f3ff', borderColor: '#ddd6fe' }}>
                <h3 style={{ color: '#6d28d9' }}>Sisa Obat</h3>
                <div className="value" style={{ color: '#6d28d9' }}>{statsStok.sisa}</div>
                <div className="sub-text">Tablet (Saat Ini)</div>
                <Package className="card-icon" size={40} style={{ opacity: 0.2, position: 'absolute', right: '20px', top: '20px', color: '#6d28d9' }} />
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
