import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'router-vendor';
            if (id.includes('framer-motion')) return 'motion-vendor';
            if (id.includes('lucide-react') || id.includes('sonner')) return 'ui-vendor';
            if (id.includes('recharts')) return 'charts-vendor';
            return 'vendor';
          }
          if (id.includes('/src/admin/') || id.includes('/src/pages/admin/') || id.includes('/src/components/admin/')) {
            return 'admin';
          }
        }
      }
    }
  }
});
