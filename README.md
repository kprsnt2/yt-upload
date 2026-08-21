# SujathaVlogs Studio 🎬

AI-Powered YouTube Video Generation Studio with Google Vertex AI Veo, Gemini AI, and Multi-language (English + Telugu) SEO metadata.

## ✨ Features

- **Google Vertex AI Veo Video Generation**: Direct text-to-video generation using Google's state-of-the-art Veo models (`veo-2.0-generate-001`, `veo-3.1-generate-preview`).
- **Viral AI Studio**: Automated trending topic discovery, AI scriptwriting, and automated video compilation.
- **AI Slideshow & Music**: Image generation, customizable style presets, audio uploading, and client-side compilation.
- **Multilingual SEO Metadata**: Automatic title, description, and hashtag generation in English and Telugu.

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 2. Environment Variables

Create `.env` in the root directory (or in `server/.env`):

```env
# Option A: Google AI Studio API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Option B: Google Cloud Vertex AI
GOOGLE_GENAI_USE_VERTEXAI=true
VERTEX_PROJECT_ID=your-google-cloud-project-id
VERTEX_LOCATION=us-central1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Veo Video Model (default: veo-2.0-generate-001)
VEO_MODEL=veo-2.0-generate-001

# Optional: Royalty-free music search
PIXABAY_API_KEY=your_pixabay_api_key_here
```

### 3. Run Development Servers

**Backend API Server:**
```bash
cd server
npm run dev
```

**Frontend (Vite):**
```bash
npm run dev
```

---

## 📡 API Endpoints

- `POST /api/generate-video` - Generates AI video using Vertex AI / Veo API (`prompt`, `aspectRatio`, `duration`, `style`, `model`).
- `POST /api/generate-images` - Generates image sequence from prompt.
- `POST /api/viral/ideas` - Generates trending content ideas.
- `POST /api/viral/script` - Generates scene-by-scene script with visual cues and narration.
- `POST /api/generate-metadata` - Generates YouTube titles, descriptions, and tags in EN & TE.
- `GET /api/music/search` - Searches royalty-free audio tracks.
- `POST /api/compile-video` - Compiles images and audio into video.
