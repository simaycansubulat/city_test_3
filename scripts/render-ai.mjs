// Sends a captured Rhino view to Nano Banana 2.1 (Google) and FLUX 3 Image (Black Forest Labs)
// and saves the two renders next to it.
//
// Keys are read from .env in the project root: GEMINI_API_KEY and BFL_API_KEY call the makers directly;
// without them, REPLICATE_API_TOKEN runs the same two models on Replicate.
// The prompt is <view>_prompt.txt next to the image (e.g. renders/sim_axo_prompt.txt), else prompt.txt.
// Run:  npm run render:ai                       (both models, renders/sim_viewport.png)
//       npm run render:ai -- --only nano        (just Nano Banana)
//       npm run render:ai -- --only flux        (just FLUX)
//       npm run render:ai -- renders/other.png  (another captured view)

import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const NANO_MODEL = 'gemini-nano-banana-2.1';
const NANO_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const FLUX_URL = 'https://api.bfl.ai/v1/flux-3-image';
const REPLICATE_NANO = 'google/nano-banana-2.1';
const REPLICATE_FLUX = 'black-forest-labs/flux-3-image';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env: the key checks below explain what is missing
}

const args = process.argv.slice(2);
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const imagePath = args.find((a, i) => !a.startsWith('--') && (onlyIndex < 0 || i !== onlyIndex + 1)) ?? 'renders/sim_viewport.png';
const base = imagePath.replace(/_viewport\.png$|\.png$/i, '');
const ownPrompt = `${base}_prompt.txt`;
const promptPath = await access(ownPrompt).then(() => ownPrompt, () => path.join(path.dirname(imagePath), 'prompt.txt'));

const image = await readFile(imagePath);
const prompt = (await readFile(promptPath, 'utf8')).trim();

// PNG stores width and height at bytes 16-23
const width = image.readUInt32BE(16);
const height = image.readUInt32BE(20);

function closestRatio(options) {
  const target = width / height;
  return options.reduce((best, r) => {
    const [w, h] = r.split(':').map(Number);
    const [bw, bh] = best.split(':').map(Number);
    return Math.abs(w / h - target) < Math.abs(bw / bh - target) ? r : best;
  });
}

function extensionFor(mime) {
  return mime?.includes('jpeg') || mime?.includes('jpg') ? 'jpg' : mime?.includes('webp') ? 'webp' : 'png';
}

async function failText(res) {
  const text = await res.text();
  return `${res.status} ${res.statusText}: ${text.slice(0, 600)}`;
}

// Walks the response and returns the first embedded image, whatever shape the API wraps it in.
function findImage(node) {
  if (!node || typeof node !== 'object') return null;
  const mime = node.mime_type ?? node.mimeType;
  if (typeof node.data === 'string' && node.data.length > 1000 && (!mime || mime.startsWith('image/'))) {
    return { data: node.data, mime: mime ?? 'image/png' };
  }
  for (const value of Object.values(node)) {
    const found = findImage(value);
    if (found) return found;
  }
  return null;
}

// Runs a model on Replicate and saves its first output image.
async function renderReplicate(model, input, suffix) {
  const token = process.env.REPLICATE_API_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' };
  // Small Replicate balances allow one new request every ~10 s: wait and try again when throttled
  let start;
  for (let attempt = 0; attempt < 8; attempt++) {
    start = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input }),
    });
    if (start.status !== 429) break;
    const wait = Number((await start.json()).retry_after ?? 10) + 1 + attempt * 3;
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  if (!start.ok) throw new Error(`Replicate ${model} request failed, ${await failText(start)}`);
  let job = await start.json();

  // Replicate keeps working after the first answer: ask every 2 seconds until done (up to 5 minutes)
  for (let i = 0; i < 150 && !['succeeded', 'failed', 'canceled'].includes(job.status); i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(job.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) throw new Error(`Replicate status check failed, ${await failText(poll)}`);
    job = await poll.json();
  }
  if (job.status !== 'succeeded') throw new Error(`Replicate ${model} stopped with status "${job.status}" ${job.error ?? ''}`);
  const url = Array.isArray(job.output) ? job.output[0] : job.output;
  const pic = await fetch(url);
  if (!pic.ok) throw new Error(`Replicate image download failed, ${await failText(pic)}`);
  const file = `${base}_${suffix}.${extensionFor(pic.headers.get('content-type') ?? url)}`;
  await writeFile(file, Buffer.from(await pic.arrayBuffer()));
  return file;
}

const dataUri = `data:image/png;base64,${image.toString('base64')}`;

async function renderNano() {
  const key = process.env.GEMINI_API_KEY;
  if (!key && process.env.REPLICATE_API_TOKEN) {
    const aspect_ratio = closestRatio(['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16']);
    return renderReplicate(REPLICATE_NANO, { prompt, image_input: [dataUri], aspect_ratio, resolution: '2K', output_format: 'png' }, 'nano-banana-2.1');
  }
  if (!key) throw new Error('GEMINI_API_KEY (or REPLICATE_API_TOKEN) is missing from .env');
  const ratio = closestRatio(['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16']);
  const res = await fetch(NANO_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: NANO_MODEL,
      input: [
        { type: 'text', text: prompt },
        { type: 'image', mime_type: 'image/png', data: image.toString('base64') },
      ],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: ratio, image_size: '2K' },
    }),
  });
  if (!res.ok) throw new Error(`Nano Banana request failed, ${await failText(res)}`);
  const found = findImage(await res.json());
  if (!found) throw new Error('Nano Banana answered without an image (it may have refused the prompt)');
  const file = `${base}_nano-banana-2.1.${extensionFor(found.mime)}`;
  await writeFile(file, Buffer.from(found.data, 'base64'));
  return file;
}

async function renderFlux() {
  const key = process.env.BFL_API_KEY;
  const ratio = closestRatio(['21:9', '2:1', '16:9', '3:2', '7:5', '4:3', '5:4', '1:1', '4:5', '3:4', '5:7', '2:3', '9:16']);
  if (!key && process.env.REPLICATE_API_TOKEN) {
    return renderReplicate(REPLICATE_FLUX, { prompt, images: [dataUri], aspect_ratio: ratio, resolution: '2k', output_format: 'png' }, 'flux-3-image');
  }
  if (!key) throw new Error('BFL_API_KEY (or REPLICATE_API_TOKEN) is missing from .env');
  const start = await fetch(FLUX_URL, {
    method: 'POST',
    headers: { 'x-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, images: [image.toString('base64')], aspect_ratio: ratio, resolution: '2k' }),
  });
  if (!start.ok) throw new Error(`FLUX request failed, ${await failText(start)}`);
  const { polling_url } = await start.json();

  // FLUX works in the background: ask every 2 seconds until the picture is ready (up to 4 minutes)
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(polling_url, { headers: { 'x-key': key } });
    if (!poll.ok) throw new Error(`FLUX status check failed, ${await failText(poll)}`);
    const job = await poll.json();
    if (job.status === 'Ready') {
      const pic = await fetch(job.result.sample);
      if (!pic.ok) throw new Error(`FLUX image download failed, ${await failText(pic)}`);
      const file = `${base}_flux-3-image.${extensionFor(pic.headers.get('content-type'))}`;
      await writeFile(file, Buffer.from(await pic.arrayBuffer()));
      return file;
    }
    if (!['Pending', 'Queued', 'Processing'].includes(job.status)) {
      throw new Error(`FLUX stopped with status "${job.status}" ${JSON.stringify(job.details ?? '')}`);
    }
  }
  throw new Error('FLUX took longer than 4 minutes');
}

const jobs = [];
if (only !== 'flux') jobs.push(['Nano Banana 2.1', renderNano]);
if (only !== 'nano') jobs.push(['FLUX 3 Image', renderFlux]);

console.log(`Rendering ${imagePath} (${width} x ${height})...`);
const results = await Promise.allSettled(jobs.map(([, run]) => run()));
results.forEach((r, i) => {
  const name = jobs[i][0];
  if (r.status === 'fulfilled') console.log(`  ${name}: saved ${r.value}`);
  else console.log(`  ${name}: ${r.reason.message}`);
});
if (results.some((r) => r.status === 'rejected')) process.exitCode = 1;
