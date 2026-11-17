import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { transcribe } from './agents/transcriber.js';
import { summarize } from './agents/summarizer.js';
import { makeSlides } from './agents/slides.js';

const app = express();
fs.mkdirSync('uploads', { recursive: true });
fs.mkdirSync('outputs', { recursive: true });

const upload = multer({ dest: 'uploads/', limits: { fileSize: 25 * 1024 * 1024 } });
app.use(express.static('public'));
app.use('/outputs', express.static('outputs'));

// ---- Live updates to the office ----
const clients = new Set();
app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  clients.add(res);
  req.on('close', () => clients.delete(res));
});
const emit = (evt) => {
  const data = `data: ${JSON.stringify(evt)}\n\n`;
  for (const c of clients) c.write(data);
};

// ---- Upload ----
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const ext = path.extname(req.file.originalname) || '.mp3';
  const audioPath = req.file.path + ext;
  fs.renameSync(req.file.path, audioPath);
  const base = path.parse(req.file.originalname).name.replace(/[^\w-]+/g, '_');
  const jobId = Date.now().toString();
  res.json({ jobId });
  runPipeline(jobId, audioPath, base);
});

async function step(jobId, agent, msg, fn) {
  emit({ type: 'status', jobId, agent, state: 'working', msg });
  try {
    const result = await fn();
    emit({ type: 'status', jobId, agent, state: 'done', url: '/outputs/' + path.basename(result.outPath) });
    return result;
  } catch (err) {
    console.error(`[${agent}]`, err);
    emit({ type: 'status', jobId, agent, state: 'error', msg: err.message });
    throw err;
  }
}

async function runPipeline(jobId, audioPath, base) {
  const out = (suffix) => path.join('outputs', `${jobId}_${base}_${suffix}`);
  try {
    const transcript = await step(jobId, 'transcriber', '🎧 Listening & typing every word...',
      () => transcribe(audioPath, out('transcript.docx'), base));

    await Promise.allSettled([
      step(jobId, 'summarizer', '📝 Writing the summary...',
        () => summarize(transcript.text, out('summary.docx'), base)),
      step(jobId, 'slides', '🎨 Designing your slides...',
        () => makeSlides(transcript.text, out('slides.pptx'), base)),
    ]);
  } catch { /* already reported */ }
  finally {
    fs.unlink(audioPath, () => {});
    emit({ type: 'complete', jobId });
  }
}

app.use((err, req, res, next) => res.status(400).json({ error: err.message }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🏢 Agent office open at http://localhost:${PORT}`));