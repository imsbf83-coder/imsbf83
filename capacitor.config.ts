import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pk.edu.imsbf83.register',
  appName: 'The Register',
  webDir: 'dist',
  server: {
    url: 'https://school-erp-imsbf-83.vercel.app',
    androidScheme: 'https',
    allowNavigation: ['school-erp-imsbf-83.vercel.app'],
  },
};

export default config;
