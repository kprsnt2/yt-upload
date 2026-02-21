import { useState, useRef } from 'react';
import {
    ArrowLeft, ArrowRight, Wand2, RefreshCw, Music, Download, Upload,
    Check, Film, Search, X, Play
} from 'lucide-react';
import axios from 'axios';
import { API } from '../config.js';
import { compileVideoInBrowser, downloadBlob, createVideoUrl } from '../lib/videoCompiler.js';

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


const VIDEO_MODELS = [
    { id: 'cheap', name: 'Cheap', note: 'Fastest & lowest cost', providerModel: 'cerspense/zeroscope_v2_576w' },
    { id: 'balanced', name: 'Balanced', note: 'Best value (recommended)', providerModel: 'THUDM/CogVideoX-2b' },
    { id: 'best', name: 'Best', note: 'Highest visual quality', providerModel: 'genmo/mochi-1-preview' },
];

export default function CreateVideoPage() {
    const [step, setStep] = useState(1);
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('vibrant');
    const [format, setFormat] = useState('short');
    const [imageCount, setImageCount] = useState(6);
    const [imageModel, setImageModel] = useState('balanced');
    const [images, setImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [progress, setProgress] = useState(0);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [customAudioUrl, setCustomAudioUrl] = useState(null);
    const [videoBlob, setVideoBlob] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [metadata, setMetadata] = useState(null);
    const [metadataLang, setMetadataLang] = useState('en');
    const [error, setError] = useState('');

    // Generate images via Vercel API route
    const handleGenerateImages = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setLoadingText('Generating AI images... This may take a minute ✨');
        setError('');
        try {
            const res = await axios.post(`${API}/generate-images`, {
                prompt, count: imageCount, style, model: imageModel,
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

    const toggleImage = (id) => {
        setSelectedImages(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Handle custom audio upload (creates a local blob URL)
    const handleAudioUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setCustomAudioUrl(url);
        setSelectedMusic({ id: 'custom', title: file.name, url, isCustom: true });
    };

    const generateMetadataForPrompt = async () => {
        setLoadingText('Generating title & tags in EN + Telugu... 📝');
        try {
            const metaRes = await axios.post(`${API}/generate-metadata`, {
                topic: prompt, format
            });
            setMetadata(metaRes.data.metadata);
        } catch {
            setMetadata({
                title_en: `${prompt.substring(0, 60)} ✨ #shorts`,
                title_te: prompt.substring(0, 60),
                description_en: `${prompt}

🙏 Subscribe to Sujatha Nanamma Vlogs!
#telugu #viral`,
                description_te: `${prompt}

🙏 సుజాతా నానమ్మ వ్లాగ్స్`,
                tags: ['telugu', 'viral', 'trending', 'shorts'],
                category: 'Entertainment',
            });
        }
    };

    const handleGenerateVideoDirectly = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setProgress(0);
        setError('');

        try {
            setLoadingText('Generating AI video from your prompt... 🎥');
            const res = await axios.post(`${API}/generate-video`, {
                prompt,
                model: imageModel,
                format,
            });

            if (!res.data?.video) {
                throw new Error('Video API did not return a playable video.');
            }

            setLoadingText('Preparing video preview...');
            const videoResponse = await fetch(res.data.video);
            const blob = await videoResponse.blob();

            setVideoBlob(blob);
            setVideoUrl(createVideoUrl(blob));
            await generateMetadataForPrompt();
            setStep(5);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to generate video from prompt');
        } finally {
            setLoading(false);
        }
    };

    // Compile video in the BROWSER (no server needed)
    const handleCompileVideo = async () => {
        setLoading(true);
        setProgress(0);
        setLoadingText('Compiling video in your browser... 🎬');
        setError('');
        try {
            const selectedImgs = images.filter(img => selectedImages.includes(img.id));
            const imageDataUrls = selectedImgs.map(img => img.data);

            const blob = await compileVideoInBrowser(imageDataUrls, {
                format,
                durationPerImage: format === 'short' ? 4 : 5,
                audioUrl: selectedMusic?.url || null,
                onProgress: (p) => {
                    setProgress(p);
                    if (p < 25) setLoadingText('Loading images... 🖼️');
                    else if (p < 90) setLoadingText(`Rendering video... ${p}% 🎬`);
                    else setLoadingText('Finalizing... ✨');
                }
            });

            setVideoBlob(blob);
            setVideoUrl(createVideoUrl(blob));

            await generateMetadataForPrompt();
            setStep(5);
        } catch (err) {
            setError(err.message || 'Failed to compile video');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (videoBlob) {
            const title = metadata?.title_en?.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 40) || 'video';
            downloadBlob(videoBlob, `${title.replace(/\s+/g, '_')}.webm`);
        }
    };

    const goNext = () => {
        if (step === 2) { handleGenerateImages(); return; }
        if (step === 4) { handleCompileVideo(); return; }
        setStep(s => Math.min(s + 1, 6));
    };

    const goBack = () => setStep(s => Math.max(s - 1, 1));

    return (
        <div className="page fade-in">
            <h2 style={{ marginBottom: '20px' }}>Create Video</h2>

            {/* Steps */}
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

            {/* Error */}
            {error && (
                <div style={{
                    padding: '12px 16px', marginBottom: '16px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <X size={16} /> {error}
                    <button onClick={() => setError('')} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Dismiss</button>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p className="loading-text loading-pulse">{loadingText}</p>
                    {progress > 0 && (
                        <div style={{ width: '100%', maxWidth: '300px' }}>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                                {progress}%
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Step Content */}
            {!loading && (
                <div className="slide-up">
                    {/* STEP 1: PROMPT */}
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
                                <div className={`format-option ${format === 'short' ? 'selected' : ''}`} onClick={() => setFormat('short')}>
                                    <div className="format-preview short" />
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Short</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>9:16 • Under 60s</div>
                                </div>
                                <div className={`format-option ${format === 'long' ? 'selected' : ''}`} onClick={() => setFormat('long')}>
                                    <div className="format-preview long" />
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Long Video</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>16:9 • 2-3 min</div>
                                </div>
                            </div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Number of images/scenes</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {[4, 6, 8, 10, 12, 15].map(n => (
                                        <button key={n} className={`btn btn-sm ${imageCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImageCount(n)}>{n}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Quick Style</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {STYLES.map(s => (
                                        <button key={s.id} className={`btn btn-sm ${style === s.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStyle(s.id)}>
                                            {s.icon} {s.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Video Model (cost vs quality)</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {VIDEO_MODELS.map(m => (
                                        <button key={m.id} className={`btn btn-sm ${imageModel === m.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImageModel(m.id)}>
                                            {m.name}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Engine: Hugging Face text-to-video • {VIDEO_MODELS.find(m => m.id === imageModel)?.providerModel}
                                </div>
                            </div>
                            <button className="btn btn-primary btn-full" onClick={handleGenerateVideoDirectly} disabled={!prompt.trim()}>
                                <Play size={16} /> Generate Video Directly from Prompt
                            </button>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                No image generation step: prompt goes directly to video + metadata.
                            </div>
                        </div>
                    )}

                    {/* STEP 2: STYLE */}
                    {step === 2 && (
                        <div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Choose Art Style</label>
                                <div className="style-grid">
                                    {STYLES.map(s => (
                                        <div key={s.id} className={`style-option ${style === s.id ? 'selected' : ''}`} onClick={() => setStyle(s.id)}>
                                            <div className="style-option-icon">{s.icon}</div>
                                            <div>{s.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label>Image Model for scene generation (optional path)</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {VIDEO_MODELS.map(m => (
                                        <button key={m.id} className={`btn btn-sm ${imageModel === m.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImageModel(m.id)}>
                                            {m.name}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    {VIDEO_MODELS.find(m => m.id === imageModel)?.note}
                                </div>
                            </div>

                            <div className="card" style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Preview</div>
                                <p style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                                    "{prompt}" — <span style={{ color: 'var(--accent)' }}>{STYLES.find(s => s.id === style)?.name}</span>
                                    {' • '}{imageCount} scenes{' • '}{format === 'short' ? '9:16 Short' : '16:9 Long'}
                                    {' • '}<span style={{ color: 'var(--accent-2)' }}>{VIDEO_MODELS.find(m => m.id === imageModel)?.name}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: IMAGES */}
                    {step === 3 && (
                        <div>
                            <div className="section-header">
                                <span className="section-title">Generated ({selectedImages.length}/{images.length} selected)</span>
                                <button className="btn btn-ghost btn-sm" onClick={handleGenerateImages}>
                                    <RefreshCw size={14} /> Redo
                                </button>
                            </div>
                            <div className={`image-grid`}>
                                {images.map(img => (
                                    <div
                                        key={img.id}
                                        className={`image-card ${format === 'long' ? 'landscape' : ''} ${selectedImages.includes(img.id) ? 'selected' : ''}`}
                                        onClick={() => toggleImage(img.id)}
                                    >
                                        <img src={img.data} alt="Generated" loading="lazy" />
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
                                    <button className="btn btn-primary" onClick={handleGenerateImages}><Wand2 size={16} /> Generate Now</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: MUSIC */}
                    {step === 4 && (
                        <div>
                            <div className="section-header">
                                <span className="section-title">Add Background Music</span>
                            </div>

                            {/* Upload custom audio */}
                            <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Upload size={20} color="var(--accent)" />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload Your Track</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MP3, WAV, OGG — your own soundtrack or downloaded remix</div>
                                    </div>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        Browse
                                        <input type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                                {selectedMusic?.isCustom && (
                                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--success)' }}>
                                        ✅ {selectedMusic.title}
                                    </div>
                                )}
                            </div>

                            {/* Skip music */}
                            <button
                                className={`btn btn-full ${!selectedMusic ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setSelectedMusic(null); setCustomAudioUrl(null); }}
                                style={{ marginBottom: '16px' }}
                            >
                                {!selectedMusic ? '✅ No Music (Selected)' : 'Skip Music (No Audio)'}
                            </button>

                            <div className="card" style={{ padding: '16px', background: 'var(--gradient-card)' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    💡 <strong>Tip:</strong> Download a Telugu folk song or remix from YouTube/SoundCloud, then upload it here.
                                    The video will be compiled with your chosen track right in your browser!
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: PREVIEW & METADATA */}
                    {step === 5 && (
                        <div>
                            {videoUrl && (
                                <div className="video-preview" style={{ marginBottom: '24px' }}>
                                    <video controls src={videoUrl} style={{ width: '100%', maxHeight: '400px' }} />
                                </div>
                            )}

                            {metadata && (
                                <div className="metadata-section">
                                    <div className="metadata-lang-tabs">
                                        <button className={`metadata-lang-tab ${metadataLang === 'en' ? 'active' : ''}`} onClick={() => setMetadataLang('en')}>
                                            🇬🇧 English
                                        </button>
                                        <button className={`metadata-lang-tab ${metadataLang === 'te' ? 'active' : ''}`} onClick={() => setMetadataLang('te')}>
                                            🇮🇳 తెలుగు
                                        </button>
                                    </div>
                                    <div className="input-group">
                                        <label>Title</label>
                                        <input className="input" value={metadataLang === 'en' ? (metadata.title_en || '') : (metadata.title_te || '')}
                                            onChange={(e) => setMetadata(prev => ({ ...prev, [metadataLang === 'en' ? 'title_en' : 'title_te']: e.target.value }))} />
                                    </div>
                                    <div className="input-group">
                                        <label>Description</label>
                                        <textarea className="textarea" rows={6}
                                            value={metadataLang === 'en' ? (metadata.description_en || '') : (metadata.description_te || '')}
                                            onChange={(e) => setMetadata(prev => ({ ...prev, [metadataLang === 'en' ? 'description_en' : 'description_te']: e.target.value }))} />
                                    </div>
                                    {metadata.tags && (
                                        <div className="input-group">
                                            <label>Tags</label>
                                            <div className="tag-list">{metadata.tags.map((tag, i) => <span key={i} className="tag selected">{tag}</span>)}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 6: PUBLISH */}
                    {step === 6 && (
                        <div>
                            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                                <h2>Your Video is Ready!</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '24px' }}>
                                    Download and upload to YouTube
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px', margin: '0 auto' }}>
                                    <button onClick={handleDownload} className="btn btn-primary btn-lg btn-full">
                                        <Download size={18} /> Download Video
                                    </button>
                                    <button className="btn btn-secondary btn-lg btn-full" disabled>
                                        <Upload size={18} /> YouTube Upload (Coming Soon)
                                    </button>
                                </div>
                            </div>
                            {metadata && (
                                <div className="card" style={{ marginTop: '16px' }}>
                                    <h4 style={{ marginBottom: '12px' }}>📋 Copy-Paste for YouTube</h4>
                                    <div style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
                                        <strong>Title:</strong> {metadata.title_en}<br />
                                        <strong>Telugu:</strong> {metadata.title_te}<br />
                                        <strong>Category:</strong> {metadata.category}<br />
                                        <strong>Tags:</strong> {metadata.tags?.join(', ')}
                                    </div>
                                    <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${metadata.title_en}\n\n${metadata.description_en}\n\nTags: ${metadata.tags?.join(', ')}`);
                                        }}>
                                        📋 Copy All
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'space-between' }}>
                        {step > 1 && (
                            <button className="btn btn-secondary" onClick={goBack}><ArrowLeft size={16} /> Back</button>
                        )}
                        <div style={{ flex: 1 }} />
                        {step < 6 && (
                            <button className="btn btn-primary" onClick={goNext} disabled={step === 1 && !prompt.trim()}>
                                {step === 2 ? <><Wand2 size={16} /> Generate Images</> :
                                    step === 4 ? <><Film size={16} /> Compile Video</> :
                                        <>Next <ArrowRight size={16} /></>}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
