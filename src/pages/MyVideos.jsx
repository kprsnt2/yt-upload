import { useState } from 'react';
import { Download, RefreshCw, Trash2, Film } from 'lucide-react';

export default function MyVideosPage() {
    // In serverless mode, videos are compiled in-browser and stored in memory/localStorage
    // This page shows videos from the current session
    const [videos, setVideos] = useState(() => {
        try {
            const saved = localStorage.getItem('sujatha_videos');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const clearHistory = () => {
        localStorage.removeItem('sujatha_videos');
        setVideos([]);
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="page fade-in">
            <div className="section-header">
                <div>
                    <h2>My Videos</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Videos are compiled in your browser — download to keep!
                    </p>
                </div>
                {videos.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={clearHistory}>
                        <Trash2 size={14} /> Clear
                    </button>
                )}
            </div>

            {videos.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">🎬</div>
                    <h3>No Videos Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Create a video from the wizard or Viral Studio — it'll compile right in your browser!
                    </p>
                    <div className="card" style={{ textAlign: 'left', padding: '16px' }}>
                        <h4 style={{ marginBottom: '12px' }}>💡 How it works:</h4>
                        <ol style={{ fontSize: '0.85rem', lineHeight: '2', color: 'var(--text-secondary)', paddingLeft: '20px' }}>
                            <li>AI generates images from your text prompt</li>
                            <li>Upload a music track (Telugu folk, devotional, etc.)</li>
                            <li>Video compiles <strong>in your browser</strong> — no server needed!</li>
                            <li>Download the .webm video</li>
                            <li>Upload to YouTube as Short or Video</li>
                        </ol>
                    </div>
                </div>
            )}

            {videos.length > 0 && (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {videos.map((video, i) => (
                        <div key={i} className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                <div style={{
                                    width: '60px', height: '60px', borderRadius: '8px',
                                    background: 'var(--bg-secondary)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Film size={24} color="var(--accent)" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {video.title || `Video ${i + 1}`}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {video.format === 'short' ? '📱 Short' : '🖥️ Long'} • {video.scenes} scenes • {formatDate(video.created)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
