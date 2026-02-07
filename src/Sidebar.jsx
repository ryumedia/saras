import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  LayoutDashboard, 
  Building2, 
  School, 
  UserCog, 
  Users, 
  User,
  Pill, 
  Activity, 
  Gift, 
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import logoSaras from './assets/Logo.png';
import './styles/SidebarMobile.css'; // Import CSS baru untuk responsif

const menuItems = [
  { path: '/', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/puskesmas', name: 'Data Puskesmas', icon: <Building2 size={20} /> },
  { path: '/sekolah', name: 'Data Sekolah', icon: <School size={20} /> },
  { path: '/admin', name: 'Data Admin', icon: <UserCog size={20} /> },
  { path: '/siswa', name: 'Data Siswa', icon: <Users size={20} /> },
  { 
    name: 'Stok Obat', 
    icon: <Pill size={20} />,
    children: [
      { path: '/stok', name: 'Data Obat' },
      { path: '/stok/dinas', name: 'Stok Dinas' },
      { path: '/stok/puskesmas', name: 'Stok Puskesmas' },
      { path: '/stok/sekolah', name: 'Stok Sekolah' },
    ]
  },
  { path: '/pengingat', name: 'Pengingat', icon: <Bell size={20} /> },
  { path: '/pemantauan', name: 'Pemantauan', icon: <Activity size={20} /> },
  { 
    name: 'Pengaturan', 
    icon: <Settings size={20} />,
    children: [
      { path: '/pengaturan/pesan', name: 'Pengaturan Pesan' },
    ]
  },
  { path: '/profil', name: 'Profil Saya', icon: <User size={20} /> },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({});
  const [adminInfo, setAdminInfo] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Tutup sidebar otomatis saat pindah halaman (navigasi)
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "admins", auth.currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            let instansiName = '';
            
            // Ambil nama instansi jika ada relatedId
            if (data.relatedId) {
              if (data.role === 'Admin Puskesmas') {
                const pDoc = await getDoc(doc(db, "puskesmas", data.relatedId));
                if (pDoc.exists()) instansiName = pDoc.data().nama;
              } else if (data.role === 'Admin Sekolah') {
                const sDoc = await getDoc(doc(db, "sekolah", data.relatedId));
                if (sDoc.exists()) instansiName = sDoc.data().nama;
              }
            }
            
            setAdminInfo({
              nama: data.nama,
              role: data.role,
              instansi: instansiName
            });
          }
        } catch (error) {
          console.error("Error fetching admin info:", error);
        }
      }
    };
    fetchAdminInfo();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Gagal logout:', error);
    }
  };

  const toggleMenu = (name) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const visibleMenuItems = useMemo(() => {
    if (!adminInfo) return [];
    const { role } = adminInfo;

    if (role === 'Super Admin') {
      return menuItems;
    }

    // Deep copy menuItems dengan cara yang aman untuk React elements (icon)
    let filtered = menuItems.map(item => {
      const newItem = { ...item };
      if (item.children) {
        newItem.children = item.children.map(child => ({ ...child }));
      }
      return newItem;
    });

    if (role === 'Admin Puskesmas') {
      const hiddenPaths = ['/puskesmas', '/admin'];
      filtered = filtered.filter(item => !hiddenPaths.includes(item.path));
      
      const stokMenu = filtered.find(item => item.name === 'Stok Obat');
      if (stokMenu && stokMenu.children) {
        const hiddenSubPaths = ['/stok', '/stok/dinas'];
        stokMenu.children = stokMenu.children.filter(child => !hiddenSubPaths.includes(child.path));
      }
    }

    if (role === 'Admin Sekolah') {
      const hiddenPaths = ['/puskesmas', '/sekolah', '/admin'];
      filtered = filtered.filter(item => !hiddenPaths.includes(item.path));

      const stokMenu = filtered.find(item => item.name === 'Stok Obat');
      if (stokMenu && stokMenu.children) {
        const hiddenSubPaths = ['/stok', '/stok/dinas', '/stok/puskesmas'];
        stokMenu.children = stokMenu.children.filter(child => !hiddenSubPaths.includes(child.path));
      }
    }
    return filtered;
  }, [adminInfo]);

  return (
    <>
      {/* Tombol Hamburger (Hanya muncul di Mobile) */}
      <button 
        className="mobile-menu-toggle" 
        onClick={() => setIsMobileOpen(true)}
        aria-label="Buka Menu"
      >
        <Menu size={24} />
      </button>

      {/* Overlay Gelap saat menu terbuka */}
      {isMobileOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="header-top-row">
          <img src={logoSaras} alt="Logo Saras" className="sidebar-logo" />
          <button className="mobile-menu-close" onClick={() => setIsMobileOpen(false)}><X size={24} /></button>
        </div>
        {adminInfo && (
          <div className="admin-info">
            <div className="admin-name">{adminInfo.nama}</div>
            <div className="admin-role">{adminInfo.role}</div>
            {adminInfo.instansi && <div className="admin-instansi">{adminInfo.instansi}</div>}
          </div>
        )}
      </div>
      <nav>
        <ul>
          {visibleMenuItems.map((item, index) => {
            // Render jika item memiliki sub-menu (children)
            if (item.children) {
              const isOpen = openMenus[item.name];
              const isActiveParent = item.children.some(child => child.path === location.pathname);
              
              return (
                <li key={index} className={`menu-item-group ${isActiveParent ? 'active-group' : ''}`}>
                  <div 
                    className="menu-item-header" 
                    onClick={() => toggleMenu(item.name)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', color: 'var(--text-color)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.icon}
                      <span>{item.name}</span>
                    </div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  
                  {isOpen && (
                    <ul className="submenu" style={{ paddingLeft: '0', listStyle: 'none', background: 'rgba(0,0,0,0.03)' }}>
                      {item.children.map((child, cIndex) => (
                        <li key={cIndex}>
                          <Link 
                            to={child.path} 
                            className={location.pathname === child.path ? 'active' : ''}
                            style={{ paddingLeft: '45px', fontSize: '0.95em' }}
                          >
                            <span>{child.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            // Render menu biasa
            return (
              <li key={index}>
                <Link to={item.path} className={location.pathname === item.path ? 'active' : ''}>
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
    </aside>
    </>
  );
}
