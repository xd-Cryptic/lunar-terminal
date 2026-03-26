import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api':    'http://localhost:8787',
      '/logs':   'http://localhost:8787',
      '/health': 'http://localhost:8787',
      '/algos':  'http://localhost:8787',
      '/chart-data': 'http://localhost:8787',
      '/portfolio':  'http://localhost:8787',
      '/ai':         'http://localhost:8787',
      '/market':     'http://localhost:8787',
      '/news':       'http://localhost:8787',
      '/quant':      'http://localhost:8787',
      '/risk':       'http://localhost:8787',
      '/backtest':   'http://localhost:8787',
      '/accounts':   'http://localhost:8787',
      '/ml':         'http://localhost:8787',
      '/rag':        'http://localhost:8787',
      '/config':     'http://localhost:8787',
      '/indicators': 'http://localhost:8787',
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
