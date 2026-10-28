import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { MODEL, think } from './scripts/future-ai.mjs'

// GitHub Pages serves the site at https://<user>.github.io/<repo>/.
// In GitHub Actions, GITHUB_REPOSITORY is "<user>/<repo>"; locally it is unset.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = repo && !repo.endsWith('.github.io') ? `/${repo}/` : '/'

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data ? JSON.parse(data) : {}))
    req.on('error', reject)
  })
}

function sendJSON(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

// The mind of Weimar, only while `npm run dev` runs on the laptop. The key stays here in Node;
// the published site has no /api and replays the runs saved in public/data/futures/ instead.
function futureAI(token) {
  return {
    name: 'future-ai',
    configureServer(server) {
      // the key only counts if Replicate accepts it; a rejected key falls back to replaying saved futures
      let keyOk = null
      server.middlewares.use('/api/future/status', async (req, res) => {
        if (keyOk === null && token) {
          try {
            const r = await fetch('https://api.replicate.com/v1/account', { headers: { Authorization: `Bearer ${token}` } })
            keyOk = r.ok
            if (!r.ok) console.warn(`[weimar] Replicate rejected REPLICATE_API_TOKEN (${r.status}); replaying saved futures instead`)
          } catch {
            return sendJSON(res, 200, { live: true, key: false })
          }
        }
        sendJSON(res, 200, { live: true, key: Boolean(token) && keyOk })
      })
      // one waking of the mind of Weimar: what it sees goes in, what it decides comes back
      server.middlewares.use('/api/future/think', async (req, res) => {
        try {
          const { context } = await readBody(req)
          sendJSON(res, 200, { decision: await think(token, context), model: MODEL })
        } catch (e) {
          sendJSON(res, 500, { error: e.message })
        }
      })
      // every game that reached 2077 joins the futures the published site replays: one file per game, plus a list
      server.middlewares.use('/api/future/save', async (req, res) => {
        try {
          const run = await readBody(req)
          const dir = 'public/data/futures'
          await mkdir(dir, { recursive: true })
          const id = run.recordedAt.replace(/[^0-9]/g, '').slice(0, 14)
          await writeFile(`${dir}/${id}.json`, JSON.stringify({ ...run, id }, null, 1))
          let index = []
          try {
            index = JSON.parse(await readFile(`${dir}/index.json`, 'utf8'))
          } catch {
            index = []
          }
          index = [...index.filter((r) => r.id !== id), { id, file: `${id}.json`, recordedAt: run.recordedAt, choices: run.choices, headline: run.headline ?? '' }]
          await writeFile(`${dir}/index.json`, JSON.stringify(index, null, 1))
          sendJSON(res, 200, { saved: `${dir}/${id}.json`, entry: index[index.length - 1] })
        } catch (e) {
          sendJSON(res, 500, { error: e.message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' loads every variable of .env, not only VITE_ ones; it is used here in Node and never sent to the page
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), futureAI(env.REPLICATE_API_TOKEN)],
    base,
    build: {
      // Three.js and its React helpers go in their own files, so a code change
      // doesn't make visitors download the whole 3D engine again.
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          },
        },
      },
    },
  }
})
