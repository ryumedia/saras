import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ryumedia.saras',
  appName: 'SARAS',
  webDir: 'dist',
  server: {
    // Ganti dengan URL Vercel Anda yang sudah dideploy
    url: 'https://saras-app.vercel.app',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000, // Tampil selama 3 detik
      launchAutoHide: true,
      backgroundColor: "#0d9488", // Warna latar belakang splash screen
      showSpinner: true,
      androidSpinnerStyle: "large", // Menggunakan spinner ukuran besar
      spinnerColor: "#ffffff" // Memberi warna putih agar terlihat jelas
    },
    StatusBar: {
      overlaysWebView: false, // PENTING: Memaksa webview berada DI BAWAH status bar, bukan di belakangnya
      backgroundColor: "#0d9488", // Menyamakan warna status bar dengan header aplikasi (Teal)
      style: "DARK" // Mengatur ikon (jam, baterai) menjadi terang/putih (karena background gelap)
    }
  }
};

export default config;