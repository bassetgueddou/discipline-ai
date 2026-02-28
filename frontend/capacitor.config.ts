import type { CapacitorConfig } from '@capacitor/cli';

// capacitor config - mobile app settings
const config: CapacitorConfig = {
  appId: 'com.discipline.ai',
  appName: 'Discipline AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // cleartext permet les requêtes HTTP (non-HTTPS) vers le backend local
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#080a0f',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080a0f',
    },
  },
  android: {
    backgroundColor: '#080a0f',
  },
  ios: {
    backgroundColor: '#080a0f',
    contentInset: 'automatic',
  },
};

export default config;
