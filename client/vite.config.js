import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  define: {
    'global': 'window',
  },
  build: {
    // CSS code splitting for faster initial load
    cssCodeSplit: true,
    // Target modern browsers for smaller bundle
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - loaded first
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Socket.io with msgpack - for real-time messaging
          socket: ['socket.io-client', 'socket.io-msgpack-parser'],
          // Crypto utilities - deferred
          crypto: ['crypto-js'],
          // Heavy 3D - only loaded on desktop login
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei']
        }
      }
    },
    // Remove console.log in production for performance
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger']
    }
  }
})

