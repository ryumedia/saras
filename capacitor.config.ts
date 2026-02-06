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
      launchShowDuration: 3000, // Tampil selama 3 detik
      launchAutoHide: true,
      backgroundColor: "#ffffff", // Warna latar belakang (putih)
      showSpinner: true,
      androidScaleType: "CENTER_CROP", // Memastikan gambar mengisi layar atau dipotong rapi
      androidSplashResourceName: "splash" // Memastikan nama file yang dicari benar
    }
  }
};

export default config;