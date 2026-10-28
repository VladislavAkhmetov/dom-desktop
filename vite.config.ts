import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { defaultNewsSources } from './src/newsCatalog'

const newsProxy = Object.fromEntries(defaultNewsSources.flatMap(source => {
  const url = new URL(source.url)
  const pagePrefix = `/news-page/${source.id}`
  return [
    [`^/news-feed/${source.id}$`, { target: url.origin, changeOrigin: true, rewrite: () => `${url.pathname}${url.search}`, timeout: 20000, proxyTimeout: 20000 }],
    [`^${pagePrefix}/`, { target: url.origin, changeOrigin: true, rewrite: (path: string) => path.slice(pagePrefix.length), timeout: 10000, proxyTimeout: 10000 }],
  ]
}))

// Figma Make preview is served over an HTTPS proxy: HMR must connect via wss on 443,
// and the proxy domains must be allowed. ALLOWED_HOSTS lists some of them; the preview can also
// be served from *.makeproxy-m.figma.site or *-figmaiframepreview.figma.site, so allow .figma.site.
const figmaHmr = process.env.FIGMA
  ? {
      hmr: { protocol: 'wss' as const, clientPort: 443 },
      allowedHosts: [
        ...(process.env.ALLOWED_HOSTS ?? '').split(',').map(host => host.trim()).filter(Boolean),
        '.figma.site',
      ],
    }
  : {}

// The strict CSP meta in index.html (script-src 'self') blocks the inline React Refresh
// preamble and the scripts Figma injects into the code-layer iframe. Drop it only for the
// Figma Make dev preview; Electron dev and production builds keep it.
const figmaPreviewCsp: Plugin = {
  name: 'figma-preview-csp',
  apply: 'serve',
  transformIndexHtml: html => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
}

export default defineConfig({
  plugins: [react(), ...(process.env.FIGMA ? [figmaPreviewCsp] : [])],
  base: './',
  server: { port: 5173, strictPort: true, host: '127.0.0.1', proxy: newsProxy, ...figmaHmr },
  preview: { proxy: newsProxy },
  build: { outDir: 'dist' }
})
