import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true, host: '127.0.0.1', proxy: newsProxy },
  preview: { proxy: newsProxy },
  build: { outDir: 'dist' }
})
