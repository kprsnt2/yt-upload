import { useState, useEffect } from 'react';
import { Film, Download, Trash2, RefreshCw, Calendar, HardDrive } from 'lucide-react';
import axios from 'axios';
import { API, getMediaUrl } from '../config.js';

export default function MyVideosPage() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchVideos = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/videos`);
            setVideos(res.data.videos || []);
        } catch (err) {
            console.error('Failed to fetch videos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, []);

    const formatSize = (bytes) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                        {videos.length} video{videos.length !== 1 ? 's' : ''} created
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={fetchVideos}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {loading && (
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p className="loading-text">Loading videos...</p>
                </div>
            )}

            {!loading && videos.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">🎬</div>
                    <h3>No Videos Yet</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Create your first video to see it here
                    </p>
                </div>
            )}

            {!loading && videos.length > 0 && (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {videos.map((video, i) => (
                        <div key={i} className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                {/* Video thumbnail/preview */}
                                <div style={{
                                    width: '80px',
                                    height: '60px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    overflow: 'hidden'
                                }}>
                                    <video
                                        src={getMediaUrl(video.url)}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        muted
                                        preload="metadata"
                                    />
                                </div>

                                {/* Video info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontWeight: 600, fontSize: '0.9rem',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {video.name.replace('.mp4', '').replace(/_/g, ' ')}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <HardDrive size={12} /> {formatSize(video.size)}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Calendar size={12} /> {formatDate(video.created)}
                                        </span>
                                    </div>
                                </div>

                                {/* Download button */}
                                <a
                                    href={`${API}/download/${video.name}`}
                                    download
                                    className="btn btn-primary btn-icon"
                                    title="Download"
                                >
                                    <Download size={16} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
