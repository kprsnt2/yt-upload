// Video generation using Vercel AI Gateway
// Primary: xai/grok-imagine-video | Fallback: alibaba/wan-v2.6-r2v

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, aspectRatio = '9:16', duration = 5, style = '' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const fullPrompt = style ? `${prompt}, ${style} style, high quality, cinematic` : `${prompt}, high quality, cinematic`;

        // Try primary model: xai/grok-imagine-video via Vercel AI Gateway
        let videoData = await tryGenerateVideo('xai/grok-imagine-video', fullPrompt, aspectRatio, duration);

        // Fallback: alibaba/wan-v2.6-r2v
        if (!videoData) {
            console.log('Primary model failed, trying fallback: alibaba/wan-v2.6-r2v');
            videoData = await tryGenerateVideo('alibaba/wan-v2.6-r2v', fullPrompt, aspectRatio, duration);
        }

        if (!videoData) {
            return res.status(500).json({
                error: 'Video generation failed on all models. Please try again later.'
            });
        }

        res.json({
            success: true,
            video: {
                data: videoData.data,
                mimeType: videoData.mimeType || 'video/mp4',
                model: videoData.model,
                prompt: fullPrompt
            }
        });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate video' });
    }
}

async function tryGenerateVideo(model, prompt, aspectRatio, duration) {
    const gatewayUrl = 'https://gateway.ai.vercel.com/v1/video/generations';

    try {
        const response = await fetch(gatewayUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Vercel AI Gateway uses project-level auth in production on Vercel
                // No API key needed when deployed on same Vercel project
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                aspect_ratio: aspectRatio,
                duration: String(duration),
            }),
            signal: AbortSignal.timeout(120000), // 2 min timeout for video gen
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`${model} failed (${response.status}):`, errText);
            return null;
        }

        const data = await response.json();

        // Handle response - Vercel AI Gateway returns video data
        if (data.data && data.data.length > 0) {
            const video = data.data[0];
            // Could be base64 or URL
            if (video.b64_json) {
                return {
                    data: `data:video/mp4;base64,${video.b64_json}`,
                    mimeType: 'video/mp4',
                    model
                };
            }
            if (video.url) {
                // Fetch the video and convert to base64 for consistent handling
                try {
                    const videoRes = await fetch(video.url, { signal: AbortSignal.timeout(30000) });
                    const buffer = Buffer.from(await videoRes.arrayBuffer());
                    const base64 = buffer.toString('base64');
                    const mime = videoRes.headers.get('content-type') || 'video/mp4';
                    return {
                        data: `data:${mime};base64,${base64}`,
                        mimeType: mime,
                        model
                    };
                } catch {
                    // Return URL directly as fallback
                    return { data: video.url, mimeType: 'video/mp4', model };
                }
            }
        }

        // Some models return the video directly as binary
        if (response.headers.get('content-type')?.includes('video')) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const base64 = buffer.toString('base64');
            const mime = response.headers.get('content-type');
            return { data: `data:${mime};base64,${base64}`, mimeType: mime, model };
        }

        return null;
    } catch (err) {
        console.warn(`${model} error:`, err.message);
        return null;
    }
}
