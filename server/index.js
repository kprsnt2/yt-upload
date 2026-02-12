import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateImages } from './services/imageGenerator.js';
import { compileVideo } from './services/videoCompiler.js';
import { searchMusic, getMusicCategories } from './services/musicService.js';
import { generateViralIdeas, generateViralScript } from './services/viralEngine.js';
import { generateMetadata } from './services/metadataGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure output directories exist
const outputDir = path.join(__dirname, 'output');
const tempDir = path.join(__dirname, 'temp');
const uploadsDir = path.join(__dirname, 'uploads');
[outputDir, tempDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/output', express.static(outputDir));
app.use('/temp', express.static(tempDir));

// Multer for file uploads (custom music)
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate AI images from prompt
app.post('/api/generate-images', async (req, res) => {
  try {
    const { prompt, count = 6, style = 'vibrant', aspectRatio = '9:16' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    
    const images = await generateImages(prompt, count, style, aspectRatio);
    res.json({ success: true, images });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate images' });
  }
});

// Search royalty-free music
app.get('/api/music/search', async (req, res) => {
  try {
    const { q = 'folk', category = '', page = 1 } = req.query;
    const results = await searchMusic(q, category, parseInt(page));
    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Music search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search music' });
  }
});

// Get music categories
app.get('/api/music/categories', (req, res) => {
  res.json({ success: true, categories: getMusicCategories() });
});

// Upload custom music
app.post('/api/music/upload', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  res.json({
    success: true,
    music: {
      id: `custom-${Date.now()}`,
      title: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      duration: 0,
      isCustom: true
    }
  });
});

// Compile video from images + audio
app.post('/api/compile-video', async (req, res) => {
  try {
    const { images, musicUrl, format = 'short', durationPerImage = 4, title = 'video' } = req.body;
    if (!images || images.length === 0) return res.status(400).json({ error: 'Images are required' });
    
    const videoPath = await compileVideo(images, musicUrl, format, durationPerImage, title);
    res.json({ success: true, videoUrl: videoPath });
  } catch (error) {
    console.error('Video compilation error:', error);
    res.status(500).json({ error: error.message || 'Failed to compile video' });
  }
});

// Generate viral content ideas
app.post('/api/viral/ideas', async (req, res) => {
  try {
    const { niche = 'telugu culture', count = 5 } = req.body;
    const ideas = await generateViralIdeas(niche, count);
    res.json({ success: true, ideas });
  } catch (error) {
    console.error('Viral ideas error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate ideas' });
  }
});

// Generate full viral script with scene descriptions
app.post('/api/viral/script', async (req, res) => {
  try {
    const { idea, format = 'short', imageCount = 8 } = req.body;
    if (!idea) return res.status(400).json({ error: 'Idea is required' });
    
    const script = await generateViralScript(idea, format, imageCount);
    res.json({ success: true, script });
  } catch (error) {
    console.error('Viral script error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate script' });
  }
});

// Generate YouTube metadata (title, desc, tags) in EN + TE
app.post('/api/generate-metadata', async (req, res) => {
  try {
    const { topic, format = 'short', language = 'both' } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });
    
    const metadata = await generateMetadata(topic, format, language);
    res.json({ success: true, metadata });
  } catch (error) {
    console.error('Metadata generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate metadata' });
  }
});

// Download video file
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

// List generated videos
app.get('/api/videos', (req, res) => {
  try {
    const files = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.mp4'))
      .map(f => ({
        name: f,
        url: `/output/${f}`,
        size: fs.statSync(path.join(outputDir, f)).size,
        created: fs.statSync(path.join(outputDir, f)).birthtime
      }))
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json({ success: true, videos: files });
  } catch {
    res.json({ success: true, videos: [] });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

app.listen(PORT, () => {
  console.log(`\n🎬 SujathaVlogs Studio API Server`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Pixabay API: ${process.env.PIXABAY_API_KEY ? '✅ Configured' : '⚠️ Missing (music search won\'t work)'}`);
  console.log('');
});
