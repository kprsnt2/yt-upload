import { useState, useRef } from 'react';
import {
    ArrowLeft, ArrowRight, Wand2, RefreshCw, Music, Download, Upload,
    Check, Image, Film, Loader2, Search, X, Play, Pause, ChevronDown
} from 'lucide-react';
import axios from 'axios';
import { API, getMediaUrl } from '../config.js';

const STEPS = [
    { id: 1, label: 'Prompt', icon: '✍️' },
    { id: 2, label: 'Style', icon: '🎨' },
    { id: 3, label: 'Images', icon: '🖼️' },
    { id: 4, label: 'Music', icon: '🎵' },
    { id: 5, label: 'Preview', icon: '🎬' },
    { id: 6, label: 'Publish', icon: '🚀' },
];

const STYLES = [
    { id: 'vibrant', name: 'Vibrant', icon: '🌈' },
    { id: 'cinematic', name: 'Cinematic', icon: '🎬' },
    { id: 'artistic', name: 'Artistic', icon: '🎨' },
    { id: 'realistic', name: 'Realistic', icon: '📷' },
    { id: 'devotional', name: 'Devotional', icon: '🪔' },
    { id: 'folk', name: 'Folk Art', icon: '🏡' },
    { id: 'anime', name: 'Anime', icon: '✨' },
];

export default function CreateVideoPage() {
    const [step, setStep] = useState(1);
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('vibrant');
    const [format, setFormat] = useState('short');
    const [imageCount, setImageCount] = useState(6);
    const [images, setImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [musicQuery, setMusicQuery] = useState('telugu folk');
    const [musicResults, setMusicResults] = useState([]);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [customAudio, setCustomAudio] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [metadata, setMetadata] = useState(null);
    const [metadataLang, setMetadataLang] = useState('en');
    const [error, setError] = useState('');
    const audioRef = useRef(null);
    const [playingTrack, setPlayingTrack] = useState(null);

    // Step 3: Generate images
    const handleGenerateImages = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setLoadingText('Generating AI images... This may take a minute ✨');
        setError('');
        try {
            const res = await axios.post(`${API}/generate-images`, {
                prompt, count: imageCount, style,
                aspectRatio: format === 'short' ? '9:16' : '16:9'
            });
            setImages(res.data.images);
            setSelectedImages(res.data.images.map(img => img.id));
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate images. Check your API key.');
        } finally {
            setLoading(false);
        }
    };

    // Toggle image selection
    const toggleImage = (id) => {
        setSelectedImages(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Step 4: Search music
    const handleSearchMusic = async () => {
        setLoading(true);
        setLoadingText('Searching for music... 🎵');
        try {
            const res = await axios.get(`${API}/music/search`, { params: { q: musicQuery } });
            setMusicResults(res.data.tracks || []);
        } catch (err) {
            setError('Music search failed');
        } finally {
            setLoading(false);
        }
    };

    // Handle custom audio upload
    const handleAudioUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('audio', file);
        try {
            const res = await axios.post(`${API}/music/upload`, formData);
            setCustomAudio(res.data.music);
            setSelectedMusic(res.data.music);
        } catch (err) {
            setError('Failed to upload audio');
        }
    };

    // Step 5: Compile video
    const handleCompileVideo = async () => {
        setLoading(true);
        setLoadingText('Compiling your video... This takes a moment 🎬');
        setError('');
        try {
            const selectedImgs = images.filter(img => selectedImages.includes(img.id));
            const res = await axios.post(`${API}/compile-video`, {
                images: selectedImgs.map(img => img.url),
                musicUrl: selectedMusic?.url || '',
                format,
                durationPerImage: format === 'short' ? 4 : 5,
                title: prompt.substring(0, 50)
            });
            setVideoUrl(res.data.videoUrl);

            // Also generate metadata
            setLoadingText('Generating title, description & tags in EN + Telugu... 📝');
            const metaRes = await axios.post(`${API}/generate-metadata`, {
                topic: prompt, format
            });
            setMetadata(metaRes.data.metadata);
            setStep(5);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to compile video');
        } finally {
            setLoading(false);
        }
    };

    const goNext = () => {
        if (step === 2) {
            handleGenerateImages();
            return;
        }
        if (step === 4) {
            handleCompileVideo();
            return;
        }
        setStep(s => Math.min(s + 1, 6));
    };

    const goBack = () => setStep(s => Math.max(s - 1, 1));

    return (
        <div className="page fade-in">
            <h2 style={{ marginBottom: '20px' }}>Create Video</h2>

            {/* Steps indicator */}
            <div className="steps">
                {STEPS.map((s) => (
                    <div
                        key={s.id}
                        className={`step ${step === s.id ? 'active' : ''} ${step > s.id ? 'completed' : ''}`}
                        onClick={() => step > s.id && setStep(s.id)}
                        style={{ cursor: step > s.id ? 'pointer' : 'default' }}
                    >
                        <span className="step-number">{step > s.id ? '✓' : s.icon}</span>
                        {s.label}
                    </div>
                ))}
            </div>

            {/* Error display */}
            {error && (
                <div style={{
                    padding: '12px 16px', marginBottom: '16px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <X size={16} /> {error}
                    <button onClick={() => setError('')} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
                        Dismiss
                    </button>
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p className="loading-text loading-pulse">{loadingText}</p>
                </div>
            )}

            {/* Step Content */}
            {!loading && (
                <div className="slide-up">
                    {/* ===== STEP 1: PROMPT ===== */}
                    {step === 1 && (
                        <div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>What's your video about?</label>
                                <textarea
                                    className="textarea"
                                    placeholder="e.g., Beautiful Telugu village sunrise with farmers working in green paddy fields, birds flying across colorful sky..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <div className="format-selector" style={{ marginBottom: '20px' }}>
                                <div
                                    className={`format-option ${format === 'short' ? 'selected' : ''}`}
                                    onClick={() => setFormat('short')}
                                >
                                    <div className="format-preview short" />
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Short</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>9:16 • Under 60s</div>
                                </div>
                                <div
                                    className={`format-option ${format === 'long' ? 'selected' : ''}`}
                                    onClick={() => setFormat('long')}
                                >
                                    <div className="format-preview long" />
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Long Video</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>16:9 • 2-3 min</div>
                                </div>
                            </div>

                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Number of images/scenes</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {[4, 6, 8, 10, 12, 15].map(n => (
                                        <button
                                            key={n}
                                            className={`btn btn-sm ${imageCount === n ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setImageCount(n)}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 2: STYLE ===== */}
                    {step === 2 && (
                        <div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Choose Art Style</label>
                                <div className="style-grid">
                                    {STYLES.map(s => (
                                        <div
                                            key={s.id}
                                            className={`style-option ${style === s.id ? 'selected' : ''}`}
                                            onClick={() => setStyle(s.id)}
                                        >
                                            <div className="style-option-icon">{s.icon}</div>
                                            <div>{s.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card" style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Preview Prompt</div>
                                <p style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                                    "{prompt}" — <span style={{ color: 'var(--accent)' }}>{STYLES.find(s => s.id === style)?.name} style</span>
                                    {' • '}{imageCount} scenes{' • '}{format === 'short' ? '9:16 Short' : '16:9 Long'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 3: IMAGES ===== */}
                    {step === 3 && (
                        <div>
                            <div className="section-header">
                                <span className="section-title">Generated Images ({selectedImages.length}/{images.length} selected)</span>
                                <button className="btn btn-ghost btn-sm" onClick={handleGenerateImages}>
                                    <RefreshCw size={14} /> Regenerate
                                </button>
                            </div>

                            <div className={`image-grid ${format === 'long' ? '' : ''}`}>
                                {images.map(img => (
                                    <div
                                        key={img.id}
                                        className={`image-card ${format === 'long' ? 'landscape' : ''} ${selectedImages.includes(img.id) ? 'selected' : ''}`}
                                        onClick={() => toggleImage(img.id)}
                                    >
                                        <img src={getMediaUrl(img.url)} alt="Generated" loading="lazy" />
                                        <div className="image-card-overlay">
                                            {selectedImages.includes(img.id) && <Check size={20} color="#10b981" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {images.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🖼️</div>
                                    <p>No images generated yet</p>
                                    <button className="btn btn-primary" onClick={handleGenerateImages}>
                                        <Wand2 size={16} /> Generate Now
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== STEP 4: MUSIC ===== */}
                    {step === 4 && (
                        <div>
                            <div className="section-header">
                                <span className="section-title">Add Background Music</span>
                            </div>

                            {/* Search bar */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <input
                                    className="input"
                                    placeholder="Search tracks (e.g., telugu folk, devotional)"
                                    value={musicQuery}
                                    onChange={(e) => setMusicQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()}
                                />
                                <button className="btn btn-primary" onClick={handleSearchMusic}>
                                    <Search size={16} />
                                </button>
                            </div>

                            {/* Quick category tags */}
                            <div className="tag-list" style={{ marginBottom: '16px' }}>
                                {['telugu folk', 'devotional', 'cinematic', 'upbeat', 'classical', 'nature'].map(tag => (
                                    <span
                                        key={tag}
                                        className={`tag ${musicQuery === tag ? 'selected' : ''}`}
                                        onClick={() => { setMusicQuery(tag); }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* Upload custom audio */}
                            <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Upload size={20} color="var(--accent)" />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload Custom Track</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MP3, WAV, OGG — Max 50MB</div>
                                    </div>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        Browse
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            onChange={handleAudioUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                                {customAudio && (
                                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--success)' }}>
                                        ✅ Uploaded: {customAudio.title}
                                    </div>
                                )}
                            </div>

                            {/* Skip music option */}
                            <button
                                className={`btn btn-full ${!selectedMusic ? 'btn-secondary' : 'btn-ghost'}`}
                                onClick={() => setSelectedMusic(null)}
                                style={{ marginBottom: '16px' }}
                            >
                                Skip Music (No Audio)
                            </button>

                            {/* Music results */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {musicResults.map(track => (
                                    <div
                                        key={track.id}
                                        className={`music-card ${selectedMusic?.id === track.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedMusic(track)}
                                    >
                                        <div className="music-icon">
                                            <Music size={20} color="white" />
                                        </div>
                                        <div className="music-info">
                                            <div className="music-title">{track.title}</div>
                                            <div className="music-meta">{track.genre || track.artist} • {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : 'N/A'}</div>
                                        </div>
                                        {selectedMusic?.id === track.id && <Check size={18} color="var(--success)" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 5: PREVIEW & METADATA ===== */}
                    {step === 5 && (
                        <div>
                            {/* Video preview */}
                            {videoUrl && (
                                <div className="video-preview" style={{ marginBottom: '24px' }}>
                                    <video
                                        controls
                                        src={getMediaUrl(videoUrl)}
                                        style={{ width: '100%', maxHeight: '400px' }}
                                    />
                                </div>
                            )}

                            {/* Metadata */}
                            {metadata && (
                                <div className="metadata-section">
                                    <div className="metadata-lang-tabs">
                                        <button
                                            className={`metadata-lang-tab ${metadataLang === 'en' ? 'active' : ''}`}
                                            onClick={() => setMetadataLang('en')}
                                        >
                                            🇬🇧 English
                                        </button>
                                        <button
                                            className={`metadata-lang-tab ${metadataLang === 'te' ? 'active' : ''}`}
                                            onClick={() => setMetadataLang('te')}
                                        >
                                            🇮🇳 తెలుగు
                                        </button>
                                    </div>

                                    <div className="input-group">
                                        <label>Title</label>
                                        <input
                                            className="input"
                                            value={metadataLang === 'en' ? (metadata.title_en || '') : (metadata.title_te || '')}
                                            onChange={(e) => {
                                                const key = metadataLang === 'en' ? 'title_en' : 'title_te';
                                                setMetadata(prev => ({ ...prev, [key]: e.target.value }));
                                            }}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Description</label>
                                        <textarea
                                            className="textarea"
                                            rows={6}
                                            value={metadataLang === 'en' ? (metadata.description_en || '') : (metadata.description_te || '')}
                                            onChange={(e) => {
                                                const key = metadataLang === 'en' ? 'description_en' : 'description_te';
                                                setMetadata(prev => ({ ...prev, [key]: e.target.value }));
                                            }}
                                        />
                                    </div>

                                    {metadata.tags && (
                                        <div className="input-group">
                                            <label>Tags</label>
                                            <div className="tag-list">
                                                {metadata.tags.map((tag, i) => (
                                                    <span key={i} className="tag selected">{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== STEP 6: PUBLISH ===== */}
                    {step === 6 && (
                        <div>
                            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                                <h2>Your Video is Ready!</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '24px' }}>
                                    Download it or upload directly to YouTube
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px', margin: '0 auto' }}>
                                    {videoUrl && (
                                        <a
                                            href={getMediaUrl(videoUrl)}
                                            download
                                            className="btn btn-primary btn-lg btn-full"
                                        >
                                            <Download size={18} /> Download Video
                                        </a>
                                    )}
                                    <button className="btn btn-secondary btn-lg btn-full" disabled>
                                        <Upload size={18} /> Upload to YouTube (Coming Soon)
                                    </button>
                                </div>
                            </div>

                            {metadata && (
                                <div className="card" style={{ marginTop: '16px' }}>
                                    <h4 style={{ marginBottom: '12px' }}>📋 Copy-Paste Metadata</h4>
                                    <div style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
                                        <strong>Title (EN):</strong> {metadata.title_en}<br />
                                        <strong>Title (TE):</strong> {metadata.title_te}<br />
                                        <strong>Category:</strong> {metadata.category}<br />
                                        <strong>Tags:</strong> {metadata.tags?.join(', ')}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'space-between' }}>
                        {step > 1 && (
                            <button className="btn btn-secondary" onClick={goBack}>
                                <ArrowLeft size={16} /> Back
                            </button>
                        )}
                        <div style={{ flex: 1 }} />
                        {step < 6 && (
                            <button
                                className="btn btn-primary"
                                onClick={goNext}
                                disabled={step === 1 && !prompt.trim()}
                            >
                                {step === 2 ? (
                                    <><Wand2 size={16} /> Generate Images</>
                                ) : step === 4 ? (
                                    <><Film size={16} /> Compile Video</>
                                ) : (
                                    <>Next <ArrowRight size={16} /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
