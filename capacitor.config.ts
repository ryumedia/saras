import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ryumedia.saras',
  appName: 'SARAS',
  webDir: 'dist',
  server: {
    // Ganti dengan URL Vercel Anda yang sudah dideploy
    url: 'https://saras-app.vercel.app',
    cleartext: true
  }
};

export default config;