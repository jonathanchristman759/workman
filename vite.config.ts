// Workman — vite.config.ts
// Vite configuration for the Tauri desktop build.
// Key difference from a web build: the host is the Tauri webview,
// not a browser, so we target the internal dev server.

import { defineConfig } from 'vite'
import react    from '@vitejs/plugin-react'
import path     from 'path'

const isTauri = process.env.TAURI_ENV_DEBUG !== undefined

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Vite dev server — Tauri connects to this during development
  server: {
    port:        5173,
    strictPort:  true,
    // Only accept connections from Tauri's webview
    host:        isTauri ? '127.0.0.1' : 'localhost',
    hmr: isTauri
      ? { protocol: 'ws', host: '127.0.0.1', port: 5183 }
      : undefined,
    watch: {
      // Tell Vite to ignore watching the Rust source
      ignored: ['**/src-tauri/**'],
    },
  },

  // Prevent Vite from obscuring Rust errors in the console
  clearScreen: false,

  // Tauri's CSP requires relative paths for assets
  base: isTauri ? './' : '/',

  build: {
    // Tauri supports ES2021+
    target:   isTauri ? ['es2021', 'chrome100', 'safari14'] : 'esnext',
    // Don't minify for debug builds — readable source in DevTools
    minify:   !isTauri || !process.env.TAURI_ENV_DEBUG,
    // Generate sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir:   'dist',
  },

  // Env variables — expose VITE_ prefixed vars to the frontend
  // Don't expose anything sensitive here
  envPrefix: ['VITE_', 'TAURI_'],
})


// ─────────────────────────────────────────────
// package.json
// Root package.json for the Tauri + React project
// ─────────────────────────────────────────────

/*
{
  "name": "workman",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":   "tauri dev",
    "build": "tauri build",
    "preview": "vite preview",
    "vite:dev": "vite",
    "vite:build": "vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api":           "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-fs":     "^2",
    "@tauri-apps/plugin-opener": "^2",
    "@tauri-apps/plugin-shell":  "^2",
    "@tiptap/extension-starter-kit": "^2",
    "@tiptap/react":             "^2",
    "i18next":                   "^23",
    "react":                     "^18",
    "react-dom":                 "^18",
    "react-i18next":             "^14"
  },
  "devDependencies": {
    "@tauri-apps/cli":           "^2",
    "@types/react":              "^18",
    "@types/react-dom":          "^18",
    "@vitejs/plugin-react":      "^4",
    "typescript":                "^5",
    "vite":                      "^5"
  }
}
*/
