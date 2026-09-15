import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

const ICLOUD_DIR = '/Users/user/Library/Mobile Documents/com~apple~CloudDocs/MultiPlatform'
const ICLOUD_FILE = path.join(ICLOUD_DIR, 'invoice_skills_icloud.json')

function iCloudSyncPlugin(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    const url = req.url?.split('?')[0]

    if (url === '/api/icloud-status' && req.method === 'GET') {
      try {
        const dirExists = fs.existsSync(ICLOUD_DIR)
        const fileExists = fs.existsSync(ICLOUD_FILE)
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            available: true,
            dirExists,
            fileExists,
            path: ICLOUD_FILE,
            updatedAt: fileExists ? fs.statSync(ICLOUD_FILE).mtimeMs : null
          })
        )
      } catch (err: any) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ available: false, error: err?.message || String(err) }))
      }
      return
    }

    if (url === '/api/icloud-rules') {
      if (req.method === 'GET') {
        try {
          if (!fs.existsSync(ICLOUD_FILE)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, exists: false }))
            return
          }
          const content = fs.readFileSync(ICLOUD_FILE, 'utf-8')
          const stat = fs.statSync(ICLOUD_FILE)
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              success: true,
              exists: true,
              content,
              updatedAt: stat.mtimeMs
            })
          )
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err?.message || String(err) }))
        }
        return
      }

      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            if (!fs.existsSync(ICLOUD_DIR)) {
              fs.mkdirSync(ICLOUD_DIR, { recursive: true })
            }
            fs.writeFileSync(ICLOUD_FILE, body, 'utf-8')
            const stat = fs.statSync(ICLOUD_FILE)
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                success: true,
                path: ICLOUD_FILE,
                updatedAt: stat.mtimeMs
              })
            )
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err?.message || String(err) }))
          }
        })
        return
      }
    }

    next()
  }

  return {
    name: 'icloud-sync-plugin',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    }
  }
}

export default defineConfig({
  plugins: [vue(), iCloudSyncPlugin()],
  server: {
    port: 5173,
    host: true // 允许局域网内 iOS 设备直接访问 Mac 服务
  }
})
