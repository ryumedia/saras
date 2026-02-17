import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Send } from 'lucide-react';
import '../styles/Pemantauan.css'; // Menggunakan style tabel yang sudah ada
import * as XLSX from 'xlsx';

export default function Pengingat() {
  const { currentUserData } = useAuth();
  const [students, setStudents] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [reports, setReports] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // State Filter & Pagination
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [searchNama, setSearchNama] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sendingId, setSendingId] = useState(null);

  const academicMonths = [
    { name: 'Jul', idx: 6, yearOffset: 0 },
    { name: 'Agu', idx: 7, yearOffset: 0 },
    { name: 'Sep', idx: 8, yearOffset: 0 },
    { name: 'Okt', idx: 9, yearOffset: 0 },
    { name: 'Nov', idx: 10, yearOffset: 0 },
    { name: 'Des', idx: 11, yearOffset: 0 },
    { name: 'Jan', idx: 0, yearOffset: 1 },
    { name: 'Feb', idx: 1, yearOffset: 1 },
    { name: 'Mar', idx: 2, yearOffset: 1 },
    { name: 'Apr', idx: 3, yearOffset: 1 },
    { name: 'Mei', idx: 4, yearOffset: 1 },
    { name: 'Jun', idx: 5, yearOffset: 1 },
  ];

  // Generate opsi tahun (2 tahun ke belakang s.d 1 tahun ke depan)
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  useEffect(() => {
    // Reset halaman saat filter berubah
    setCurrentPage(1);
  }, [filterPuskesmas, filterSekolah, filterKelas, searchNama, selectedYear]);

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

  // Auto-set filter puskesmas jika admin sekolah login (setelah data sekolah termuat)
  useEffect(() => {
    if (currentUserData?.role === 'Admin Sekolah' && sekolahList.length > 0) {
      const mySchool = sekolahList.find(s => s.id === currentUserData.relatedId);
      if (mySchool) {
        setFilterPuskesmas(mySchool.puskesmasId);
      }
    }
  }, [currentUserData, sekolahList]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Ambil Data Master (Sekolah & Puskesmas)
        const [sekolahSnap, puskesmasSnap, kelasSnap] = await Promise.all([
          getDocs(collection(db, "sekolah")),
          getDocs(collection(db, "puskesmas")),
          getDocs(collection(db, "kelas"))
        ]);
        
        setSekolahList(sekolahSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setPuskesmasList(puskesmasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setKelasList(kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // 2. Ambil Data Siswa Berdasarkan Role
        let qSiswa = collection(db, "siswa");
        
        if (currentUserData.role === 'Admin Sekolah') {
          qSiswa = query(collection(db, "siswa"), where("sekolahId", "==", currentUserData.relatedId));
        } else if (currentUserData.role === 'Admin Puskesmas') {
          // Ambil sekolah binaan dulu
          const schoolsSnap = await getDocs(query(collection(db, "sekolah"), where("puskesmasId", "==", currentUserData.relatedId)));
          const schoolIds = schoolsSnap.docs.map(d => d.id);
          
          if (schoolIds.length > 0) {
            // Jika sekolah binaan sedikit, pakai 'in', jika banyak fetch semua lalu filter di client
            // Untuk keamanan query limit, kita fetch semua siswa lalu filter manual (asumsi data belum ribuan)
            qSiswa = collection(db, "siswa");
          } else {
            setStudents([]);
            setLoading(false);
            return;
          }
        }

        const siswaSnap = await getDocs(qSiswa);
        let fetchedStudents = siswaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter manual untuk Admin Puskesmas (jika fetch all)
        if (currentUserData.role === 'Admin Puskesmas') {
           const schoolsSnap = await getDocs(query(collection(db, "sekolah"), where("puskesmasId", "==", currentUserData.relatedId)));
           const schoolIds = schoolsSnap.docs.map(d => d.id);
           fetchedStudents = fetchedStudents.filter(s => schoolIds.includes(s.sekolahId));
        }

        setStudents(fetchedStudents);

        // 3. Ambil Laporan & Distribusi Tahun Ajaran Terpilih (Juli - Juni)
        const startStr = `${selectedYear}-07-01`;
        const endStr = `${selectedYear + 1}-06-30`;
        
        const qReports = query(
            collection(db, "laporan_minum_obat"),
            where("tanggalLapor", ">=", startStr),
            where("tanggalLapor", "<=", endStr)
        );
        
        const qDist = query(
            collection(db, "sekolah_transaksi"),
            where("tanggal", ">=", startStr),
            where("tanggal", "<=", endStr),
            where("tipe", "==", "keluar")
        );

        const [reportsSnap, distSnap] = await Promise.all([
            getDocs(qReports),
            getDocs(qDist)
        ]);
        setReports(reportsSnap.docs.map(doc => doc.data()));
        setDistributions(distSnap.docs.map(doc => doc.data()));

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (currentUserData) {
      fetchData();
    }
  }, [currentUserData, selectedYear]);

  // Agregasi Data: Map Siswa -> Jumlah Obat per Bulan
  const filteredData = useMemo(() => {
    // 1. Filter Siswa terlebih dahulu
    const filteredStudents = students.filter(s => {
      const school = sekolahList.find(sch => sch.id === s.sekolahId);
      const puskesmasId = school ? school.puskesmasId : '';

      const matchPuskesmas = filterPuskesmas ? puskesmasId === filterPuskesmas : true;
      const matchSekolah = filterSekolah ? s.sekolahId === filterSekolah : true;
      const matchKelas = filterKelas ? s.kelas === filterKelas : true;
      const matchNama = searchNama ? s.nama.toLowerCase().includes(searchNama.toLowerCase()) : true;

      return matchPuskesmas && matchSekolah && matchKelas && matchNama;
    });

    // 2. Map Data Laporan ke Siswa yang sudah difilter
    const data = {}; 
    filteredStudents.forEach(s => {
      data[s.id] = {
        student: s,
        months: Array(12).fill(null).map(() => ({ received: 0, consumed: 0 })),
        totalReceived: 0,
        totalConsumed: 0
      };
    });

    // Isi dengan data laporan (Diminum)
    reports.forEach(r => {
      if (data[r.siswaId]) {
        const date = new Date(r.tanggalLapor);
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Mapping bulan kalender ke indeks tahun ajaran (0=Jul, 11=Jun)
        let arrIdx = -1;
        if (year === selectedYear && month >= 6) arrIdx = month - 6;
        else if (year === selectedYear + 1 && month < 6) arrIdx = month + 6;

        if (arrIdx !== -1) {
            const qty = parseInt(r.jumlah) || 0;
            data[r.siswaId].months[arrIdx].consumed += qty;
            data[r.siswaId].totalConsumed += qty;
        }
      }
    });

    // Isi dengan data distribusi (Diterima)
    distributions.forEach(d => {
        if (d.siswaIds && Array.isArray(d.siswaIds)) {
            const date = new Date(d.tanggal);
            const month = date.getMonth();
            const year = date.getFullYear();
            
            let arrIdx = -1;
            if (year === selectedYear && month >= 6) arrIdx = month - 6;
            else if (year === selectedYear + 1 && month < 6) arrIdx = month + 6;

            d.siswaIds.forEach(sid => {
                if (data[sid]) {
                    const qty = parseInt(d.jumlahPerSiswa) || 0;
                    if (arrIdx !== -1) {
                        data[sid].months[arrIdx].received += qty;
                    }
                    data[sid].totalReceived += qty;
                }
            });
        }
    });

    return Object.values(data);
  }, [students, reports, distributions, filterPuskesmas, filterSekolah, filterKelas, searchNama, sekolahList, selectedYear]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleSendMessage = async (student) => {
    if (sendingId) return;
    
    if (!student.wa) {
      alert("Nomor WA siswa tidak tersedia.");
      return;
    }

    if (!confirm(`Kirim pesan pengingat ke ${student.nama}?`)) return;

    setSendingId(student.id);
    try {
      // 1. Ambil Pengaturan WA
      const settingsSnap = await getDoc(doc(db, "pengaturan", "pesan_wa"));
      if (!settingsSnap.exists()) {
        alert("Pengaturan pesan WA belum diset. Silakan ke menu Pengaturan -> Pengaturan Pesan.");
        setSendingId(null);
        return;
      }
      const settings = settingsSnap.data();

      if (!settings.apiKey || !settings.nomorPengirim) {
        alert("API Key atau Nomor Pengirim belum dikonfigurasi.");
        setSendingId(null);
        return;
      }

      // 2. Format Pesan
      let message = settings.pesanWA || "Halo {nama_siswa}, jangan lupa minum obat ya.";
      
      const school = sekolahList.find(s => s.id === student.sekolahId);
      const schoolName = school ? school.nama : '';
      
      const fullMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const currentMonthName = fullMonths[new Date().getMonth()];

      message = message
        .replace(/{nama_siswa}/g, student.nama)
        .replace(/{nama_sekolah}/g, schoolName)
        .replace(/{bulan}/g, currentMonthName)
        .replace(/{tahun}/g, selectedYear);

      // 3. Format Nomor WA (Pastikan 62)
      let targetWa = String(student.wa).trim();
      targetWa = targetWa.replace(/[^0-9]/g, ''); // Hapus non-digit
      
      if (targetWa.startsWith('0')) {
        targetWa = '62' + targetWa.slice(1);
      }

      // 4. Kirim via API Starsender
      const response = await fetch("https://starsender.online/api/sendText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": settings.apiKey
        },
        body: JSON.stringify({
          message: message,
          tujuan: targetWa,
          sender: settings.nomorPengirim
        })
      });

      const result = await response.json();

      // Cek status true atau jika pesan mengandung kata 'Success' (antisipasi respon API)
      if (result.status || (result.message && result.message.includes("Success"))) {
        alert(`Pesan berhasil dikirim ke ${student.nama}`);
      } else {
        alert(`Gagal mengirim pesan: ${result.message}`);
      }

    } catch (err) {
      console.error("Error sending message:", err);
      alert("Terjadi kesalahan saat mengirim pesan.");
    } finally {
      setSendingId(null);
    }
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert("Tidak ada data untuk diexport.");
      return;
    }

    const data = filteredData.map((item, index) => {
      const school = sekolahList.find(s => s.id === item.student.sekolahId);
      const schoolName = school ? school.nama : '-';
      
      let className = item.student.kelas;
      if (item.student.kelasId) {
        const k = kelasList.find(k => k.id === item.student.kelasId);
        if (k) className = k.namaKelas;
      }

      const row = {
        'No': index + 1,
        'Nama Siswa': item.student.nama,
        'Sekolah': schoolName,
        'Kelas': className,
      };

      item.months.forEach((monthData, idx) => {
        const monthName = academicMonths[idx].name;
        const yearSuffix = (selectedYear + academicMonths[idx].yearOffset).toString().slice(-2);
        row[`${monthName} '${yearSuffix} (D)`] = monthData.received || 0;
        row[`${monthName} '${yearSuffix} (M)`] = monthData.consumed || 0;
      });

      row['Total Diterima'] = item.totalReceived;
      row['Total Diminum'] = item.totalConsumed;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pengingat");
    XLSX.writeFile(wb, `Pengingat_Obat_${selectedYear}-${selectedYear + 1}.xlsx`);
  };

  return (
    <div className="pemantauan-container"> {/* Menggunakan container style yang sama */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Pengingat Minum Obat</h1>
        <button 
          onClick={handleExportExcel}
          style={{ 
            backgroundColor: '#10b981', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: '6px', 
            border: 'none', 
            cursor: 'pointer', 
            fontWeight: '600' 
          }}
        >
          Export Excel
        </button>
      </div>

      <div className="filters" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Tahun Ajaran:</label>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}-{y+1}</option>)}
          </select>
        </div>

        <select 
          value={filterPuskesmas} 
          onChange={e => { setFilterPuskesmas(e.target.value); setFilterSekolah(''); }} 
          disabled={currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '180px', backgroundColor: (currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah') ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Puskesmas</option>
          {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>

        <select 
          value={filterSekolah} 
          onChange={e => setFilterSekolah(e.target.value)} 
          disabled={currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '180px', backgroundColor: currentUserData?.role === 'Admin Sekolah' ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Sekolah</option>
          {sekolahList
            .filter(s => !filterPuskesmas || s.puskesmasId === filterPuskesmas)
            .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>

        <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '100px' }}>
          <option value="">Semua Kelas</option>
          {[7, 8, 9, 10, 11, 12].map(k => <option key={k} value={String(k)}>{k}</option>)}
        </select>

        <input 
          type="text" 
          placeholder="Cari Nama Siswa..." 
          value={searchNama} 
          onChange={e => setSearchNama(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', flex: 1, minWidth: '150px' }}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{ verticalAlign: 'middle' }}>No</th>
              <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Nama Siswa</th>
              {academicMonths.map((m, i) => (
                <th key={i} colSpan="2" style={{ textAlign: 'center', fontSize: '0.85em', padding: '5px' }}>
                  {m.name} <br/><span style={{fontSize: '0.8em', color: '#666'}}>{(selectedYear + m.yearOffset).toString().slice(-2)}</span>
                </th>
              ))}
              <th rowSpan="2" style={{ verticalAlign: 'middle', textAlign: 'center' }}>TD</th>
              <th rowSpan="2" style={{ verticalAlign: 'middle', textAlign: 'center' }}>TM</th>
              <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Aksi</th>
            </tr>
            <tr>
              {academicMonths.map((_, i) => (
                <React.Fragment key={i}>
                  <th style={{ textAlign: 'center', fontSize: '0.7em', padding: '2px', color: '#2563eb', minWidth: '25px' }}>D</th>
                  <th style={{ textAlign: 'center', fontSize: '0.7em', padding: '2px', color: '#059669', minWidth: '25px' }}>M</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="17" style={{ textAlign: 'center' }}>Memuat data...</td></tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((item, index) => (
                <tr key={item.student.id}>
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td>{item.student.nama}</td>
                  {item.months.map((monthData, idx) => (
                    <React.Fragment key={idx}>
                      <td style={{ textAlign: 'center', fontSize: '0.8em', color: monthData.received > 0 ? '#2563eb' : '#e5e7eb', padding: '4px' }}>
                        {monthData.received || '-'}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.8em', fontWeight: monthData.consumed > 0 ? 'bold' : 'normal', color: monthData.consumed > 0 ? '#059669' : '#e5e7eb', padding: '4px' }}>
                        {monthData.consumed || '-'}
                      </td>
                    </React.Fragment>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{item.totalReceived}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{item.totalConsumed}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleSendMessage(item.student)}
                      disabled={sendingId === item.student.id}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: sendingId === item.student.id ? 'wait' : 'pointer', 
                        color: sendingId === item.student.id ? '#9ca3af' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%'
                      }}
                      title="Kirim Pesan"
                    >
                      {sendingId === item.student.id ? '...' : <Send size={18} />}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="17" style={{ textAlign: 'center' }}>Tidak ada data siswa.</td></tr>
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
