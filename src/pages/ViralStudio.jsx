import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, RefreshCw, Copy, Rocket } from 'lucide-react';
import axios from 'axios';
import { API } from '../config.js';
import { compileVideoInBrowser, downloadBlob, createVideoUrl } from '../lib/videoCompiler.js';

const IMAGE_MODELS = [
    { id: 'cheap', name: 'Cheap' },
    { id: 'balanced', name: 'Balanced' },
    { id: 'best', name: 'Best' },
];

export default function ViralStudioPage() {
    const navigate = useNavigate();
    const [niche, setNiche] = useState('telugu culture');
    const [ideas, setIdeas] = useState([]);
    const [selectedIdea, setSelectedIdea] = useState(null);
    const [script, setScript] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [phase, setPhase] = useState('ideas'); // ideas | script | generating
    const [error, setError] = useState('');
    const [autoProgress, setAutoProgress] = useState(0);
    const [autoImages, setAutoImages] = useState([]);
    const [videoBlob, setVideoBlob] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [imageModel, setImageModel] = useState('balanced');

    const handleGetIdeas = async () => {
        setLoading(true);
        setLoadingText('AI is researching trending topics... 🔍');
        setError('');
        try {
            const res = await axios.post(`${API}/viral-ideas`, { niche, count: 5 });
            setIdeas(res.data.ideas);
            setPhase('ideas');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate ideas');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateScript = async (idea) => {
        setSelectedIdea(idea);
        setLoading(true);
        setLoadingText('AI is writing a viral script... ✍️');
        setError('');
        try {
            const res = await axios.post(`${API}/viral-script`, {
                idea: typeof idea === 'string' ? idea : idea.title,
                format: idea.format === 'Long' ? 'long' : 'short',
                imageCount: idea.format === 'Long' ? 12 : 6
            });
            setScript(res.data.script);
            setPhase('script');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate script');
        } finally {
            setLoading(false);
        }
    };

    // Full auto: generate images from script then compile video in browser
    const handleAutoGenerate = async () => {
        if (!script || !script.scenes) return;
        setPhase('generating');
        setAutoProgress(0);
        setError('');

        const allImages = [];
        for (let i = 0; i < script.scenes.length; i++) {
            const scene = script.scenes[i];
            setAutoProgress(Math.round(((i + 1) / script.scenes.length) * 60));
            setLoadingText(`Generating scene ${i + 1}/${script.scenes.length}...`);

            try {
                const res = await axios.post(`${API}/generate-images`, {
                    prompt: scene.imagePrompt || scene.narration,
                    count: 1,
                    style: 'cinematic',
                    model: imageModel,
                    aspectRatio: selectedIdea?.format === 'Long' ? '16:9' : '9:16'
                });
                if (res.data.images?.length > 0) {
                    allImages.push(...res.data.images);
                }
            } catch (err) {
                console.warn(`Scene ${i + 1} failed:`, err.message);
            }
        }

        setAutoImages(allImages);

        // Compile video in browser
        if (allImages.length > 0) {
            setAutoProgress(65);
            setLoadingText('Compiling video in your browser... 🎬');
            try {
                const fmt = selectedIdea?.format === 'Long' ? 'long' : 'short';
                const blob = await compileVideoInBrowser(
                    allImages.map(img => img.data),
                    {
                        format: fmt,
                        durationPerImage: fmt === 'long' ? 5 : 4,
                        onProgress: (p) => setAutoProgress(65 + Math.round(p * 0.3))
                    }
                );
                setVideoBlob(blob);
                setVideoUrl(createVideoUrl(blob));
            } catch (err) {
                setError('Video compilation failed but images were generated');
            }
        }

        setAutoProgress(100);
        setLoadingText('Done! 🎉');
    };

    const copyMetadata = () => {
        if (!script) return;
        const text = `Title: ${script.overallTitle}\n\nTelugu: ${script.overallTitleTelugu}\n\nDescription:\n${script.description}\n\n${script.descriptionTelugu}\n\nTags: ${script.tags?.join(', ')}`;
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="page fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Sparkles size={24} color="var(--accent)" />
                <div>
                    <h2>Viral AI Studio</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI finds trending topics & creates videos automatically</p>
                </div>
            </div>

            {/* Niche selector */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div className="input-group" style={{ marginBottom: '16px' }}>
                    <label>Content Niche</label>
                    <div className="tag-list">
                        {['telugu culture', 'devotional', 'village life', 'festivals', 'cooking', 'travel', 'mythology', 'motivational', 'nature', 'funny'].map(tag => (
                            <span key={tag} className={`tag ${niche === tag ? 'selected' : ''}`} onClick={() => setNiche(tag)}>{tag}</span>
                        ))}
                    </div>
                </div>
                <div className="input-group" style={{ marginBottom: '12px' }}>
                    <label>Image Model (cost vs quality)</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {IMAGE_MODELS.map(m => (
                            <button key={m.id} type="button" className={`btn btn-sm ${imageModel === m.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImageModel(m.id)}>
                                {m.name}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="btn btn-primary btn-full" onClick={handleGetIdeas} disabled={loading}>
                    <Zap size={16} /> Get Viral Ideas
                </button>
            </div>

            {error && (
                <div style={{ padding: '12px', marginBottom: '16px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem' }}>
                    ❌ {error}
                </div>
            )}

            {loading && (
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p className="loading-text loading-pulse">{loadingText}</p>
                </div>
            )}

            {/* Ideas list */}
            {!loading && phase === 'ideas' && ideas.length > 0 && (
                <div>
                    <div className="section-header">
                        <span className="section-title">🔥 Trending Ideas</span>
                        <button className="btn btn-ghost btn-sm" onClick={handleGetIdeas}><RefreshCw size={14} /> Refresh</button>
                    </div>
                    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {ideas.map((idea, i) => (
                            <div key={i} className="card idea-card card-glow" onClick={() => handleGenerateScript(idea)}>
                                <h4>{idea.title}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{idea.hook}</p>
                                <div className="idea-meta">
                                    <span className="badge badge-primary">{idea.format}</span>
                                    <span className="badge badge-accent">{idea.musicMood}</span>
                                    <span className="badge badge-success">{idea.theme?.substring(0, 20)}</span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>💡 {idea.viralReason}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Script view */}
            {!loading && phase === 'script' && script && (
                <div>
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <h3>📜 Generated Script</h3>
                            <button className="btn btn-ghost btn-sm" onClick={copyMetadata} style={{ marginLeft: 'auto' }}><Copy size={14} /> Copy</button>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Title (EN)</div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{script.overallTitle}</div>
                        </div>
                        {script.overallTitleTelugu && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Title (Telugu)</div>
                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{script.overallTitleTelugu}</div>
                            </div>
                        )}
                        {script.tags && (
                            <div className="tag-list" style={{ marginBottom: '16px' }}>
                                {script.tags.slice(0, 10).map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                            </div>
                        )}
                    </div>

                    {script.scenes && (
                        <div>
                            <h4 style={{ marginBottom: '12px' }}>🎬 Scenes ({script.scenes.length})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {script.scenes.map((scene, i) => (
                                    <div key={i} className="card" style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <div className="badge badge-accent">{scene.sceneNumber || i + 1}</div>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>{scene.imagePrompt}</p>
                                                {scene.narration && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>📝 {scene.narration}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" onClick={() => setPhase('ideas')}>← Back to Ideas</button>
                        <button className="btn btn-primary btn-full" onClick={handleAutoGenerate}><Rocket size={16} /> Auto Generate Everything</button>
                    </div>
                </div>
            )}

            {/* Auto generation progress */}
            {phase === 'generating' && (
                <div>
                    <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                        {autoProgress < 100 ? (
                            <>
                                <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
                                <h3>Auto Generating...</h3>
                                <p className="loading-text loading-pulse" style={{ marginTop: '8px' }}>{loadingText}</p>
                                <div className="progress-bar" style={{ marginTop: '20px' }}>
                                    <div className="progress-fill" style={{ width: `${autoProgress}%` }} />
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>{autoProgress}% complete</p>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                                <h2>Video Ready!</h2>
                                <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px' }}>{autoImages.length} scenes generated and compiled</p>
                                {videoUrl && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <video controls src={videoUrl} style={{ width: '100%', maxHeight: '300px', borderRadius: 'var(--radius-sm)' }} />
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px', margin: '0 auto' }}>
                                    {videoBlob && (
                                        <button onClick={() => downloadBlob(videoBlob, 'viral_video.webm')} className="btn btn-primary btn-lg btn-full">
                                            ⬇️ Download Video
                                        </button>
                                    )}
                                    <button className="btn btn-secondary" onClick={() => { setPhase('ideas'); setAutoProgress(0); }}>Create Another</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {!loading && phase === 'ideas' && ideas.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">🚀</div>
                    <h3>Ready to Go Viral?</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Select a niche and click "Get Viral Ideas" to start</p>
                </div>
            )}
        </div>
    );
}
