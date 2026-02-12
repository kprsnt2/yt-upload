import fetch from 'node-fetch';

/**
 * Search for royalty-free music using Pixabay API
 * Free API key from pixabay.com
 */
export async function searchMusic(query = 'folk', category = '', page = 1) {
    const apiKey = process.env.PIXABAY_API_KEY;

    // If no Pixabay key, return curated default suggestions
    if (!apiKey) {
        return {
            tracks: getDefaultTracks(query),
            total: 0,
            page: 1,
            note: 'Using default suggestions. Add PIXABAY_API_KEY for full music search.'
        };
    }

    const params = new URLSearchParams({
        key: apiKey,
        q: query,
        per_page: '20',
        page: String(page),
        order: 'popular'
    });

    if (category) params.set('category', category);

    const response = await fetch(`https://pixabay.com/api/videos/music/?${params}`);

    if (!response.ok) {
        // Try the audio API instead
        return await searchPixabayAudio(apiKey, query, page);
    }

    const data = await response.json();

    return {
        tracks: (data.hits || []).map(hit => ({
            id: hit.id,
            title: hit.tags || query,
            artist: hit.user || 'Unknown',
            duration: hit.duration || 0,
            url: hit.audio || hit.videos?.medium?.url || '',
            previewUrl: hit.audio || '',
            source: 'pixabay',
            tags: hit.tags || ''
        })),
        total: data.totalHits || 0,
        page
    };
}

async function searchPixabayAudio(apiKey, query, page) {
    // Fallback: use Pixabay main API to find audio-related content
    try {
        const params = new URLSearchParams({
            key: apiKey,
            q: `${query} music soundtrack`,
            per_page: '20',
            page: String(page),
            order: 'popular'
        });

        const response = await fetch(`https://pixabay.com/api/?${params}`);
        if (response.ok) {
            const data = await response.json();
            return {
                tracks: getDefaultTracks(query),
                total: data.totalHits || 0,
                page,
                note: 'Showing curated suggestions. Full audio search requires Pixabay Music API access.'
            };
        }
    } catch (err) {
        console.warn('Pixabay audio fallback failed:', err.message);
    }

    return { tracks: getDefaultTracks(query), total: 0, page: 1 };
}

/**
 * Get curated default track suggestions for common categories
 */
function getDefaultTracks(query = '') {
    const q = query.toLowerCase();
    const tracks = [
        { id: 'def-1', title: 'Upbeat Folk Rhythm', genre: 'folk', mood: 'energetic', duration: 180 },
        { id: 'def-2', title: 'Traditional Drums', genre: 'folk', mood: 'rhythmic', duration: 150 },
        { id: 'def-3', title: 'Devotional Melody', genre: 'devotional', mood: 'spiritual', duration: 200 },
        { id: 'def-4', title: 'Classical Flute', genre: 'classical', mood: 'calm', duration: 240 },
        { id: 'def-5', title: 'Festive Celebration', genre: 'folk', mood: 'happy', duration: 160 },
        { id: 'def-6', title: 'Nature Ambient', genre: 'ambient', mood: 'peaceful', duration: 300 },
        { id: 'def-7', title: 'Cinematic Epic', genre: 'cinematic', mood: 'dramatic', duration: 180 },
        { id: 'def-8', title: 'Modern Dance Beat', genre: 'electronic', mood: 'upbeat', duration: 200 },
        { id: 'def-9', title: 'Romantic Strings', genre: 'classical', mood: 'romantic', duration: 220 },
        { id: 'def-10', title: 'Village Life', genre: 'folk', mood: 'nostalgic', duration: 190 },
    ];

    // Filter by query relevance
    if (q.includes('folk') || q.includes('telugu')) {
        return tracks.filter(t => t.genre === 'folk');
    }
    if (q.includes('devotion') || q.includes('spiritual') || q.includes('bhakti')) {
        return tracks.filter(t => t.genre === 'devotional' || t.mood === 'spiritual');
    }

    return tracks;
}

/**
 * Get available music categories
 */
export function getMusicCategories() {
    return [
        { id: 'folk', name: 'Telugu Folk', icon: '🎵', description: 'Traditional Telugu folk music' },
        { id: 'devotional', name: 'Devotional', icon: '🙏', description: 'Bhakti & spiritual music' },
        { id: 'classical', name: 'Classical', icon: '🎶', description: 'Indian classical instruments' },
        { id: 'cinematic', name: 'Cinematic', icon: '🎬', description: 'Epic & dramatic soundtracks' },
        { id: 'ambient', name: 'Ambient', icon: '🌿', description: 'Nature & peaceful sounds' },
        { id: 'upbeat', name: 'Upbeat', icon: '💃', description: 'Energetic & dance-worthy' },
        { id: 'romantic', name: 'Romantic', icon: '❤️', description: 'Love & emotional melodies' },
        { id: 'festival', name: 'Festival', icon: '🎉', description: 'Celebratory & festive tracks' },
    ];
}
