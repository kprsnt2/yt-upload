// Video generation using xAI Grok Imagine Video API directly (no Vercel Gateway)
// Requires XAI_API_KEY environment variable (get free $25/month from console.x.ai)
// xAI video gen is async: submit job -> poll for result

const XAI_BASE = 'https://api.x.ai/v1';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'XAI_API_KEY not configured. Get a free key from console.x.ai and add it to Vercel Environment Variables.'
        });
    }

    try {
        const { prompt, aspectRatio = '9:16', duration = 5, style = '' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const fullPrompt = style
            ? `${prompt}, ${style} style, high quality, cinematic`
            : `${prompt}, high quality, cinematic`;

        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        // Step 1: Submit video generation job
        console.log('Submitting video generation job to xAI...');
        const submitRes = await fetch(`${XAI_BASE}/video/generations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: 'grok-2-image',
                prompt: fullPrompt,
                response_format: 'url',
            }),
        });

        if (!submitRes.ok) {
            const errBody = await submitRes.text();
            console.error('xAI submit error:', submitRes.status, errBody);
            return res.status(submitRes.status).json({
                error: `xAI API error (${submitRes.status}): ${errBody}`
            });
        }

        const submitData = await submitRes.json();
        const requestId = submitData.request_id || submitData.id;

        if (!requestId) {
            // Some models return the result directly
            if (submitData.data && submitData.data.length > 0) {
                const videoUrl = submitData.data[0].url || submitData.data[0].b64_json;
                return res.json({
                    success: true,
                    video: {
                        data: videoUrl.startsWith('http') ? videoUrl : `data:video/mp4;base64,${videoUrl}`,
                        mimeType: 'video/mp4',
                        model: 'grok-imagine-video',
                        prompt: fullPrompt,
                    }
                });
            }
            return res.status(500).json({ error: 'No request ID or direct result from xAI' });
        }

        // Step 2: Poll for result (async generation)
        console.log(`Polling for result, request_id: ${requestId}`);
        const maxAttempts = 60; // 60 * 2s = 2 minutes max wait
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds between polls

            const pollRes = await fetch(`${XAI_BASE}/video/generations/${requestId}`, {
                method: 'GET',
                headers,
            });

            if (!pollRes.ok) {
                console.warn(`Poll attempt ${attempt + 1} failed:`, pollRes.status);
                continue;
            }

            const pollData = await pollRes.json();
            const status = pollData.status || pollData.state;

            if (status === 'completed' || status === 'succeeded' || status === 'complete') {
                // Get the video URL
                const videoUrl = pollData.video_url || pollData.url ||
                    pollData.data?.[0]?.url || pollData.output?.url ||
                    pollData.result?.url;

                if (videoUrl) {
                    return res.json({
                        success: true,
                        video: {
                            data: videoUrl,
                            mimeType: 'video/mp4',
                            model: 'grok-imagine-video',
                            prompt: fullPrompt,
                        }
                    });
                }

                // Check for base64 data
                const b64 = pollData.data?.[0]?.b64_json || pollData.output?.b64_json;
                if (b64) {
                    return res.json({
                        success: true,
                        video: {
                            data: `data:video/mp4;base64,${b64}`,
                            mimeType: 'video/mp4',
                            model: 'grok-imagine-video',
                            prompt: fullPrompt,
                        }
                    });
                }

                // Return whatever we got
                return res.json({
                    success: true,
                    video: {
                        data: JSON.stringify(pollData),
                        mimeType: 'video/mp4',
                        model: 'grok-imagine-video',
                        prompt: fullPrompt,
                    }
                });
            }

            if (status === 'failed' || status === 'error') {
                return res.status(500).json({
                    error: `Video generation failed: ${pollData.error || pollData.message || 'Unknown error'}`
                });
            }

            console.log(`Poll ${attempt + 1}: status=${status}`);
        }

        return res.status(504).json({
            error: 'Video generation timed out after 2 minutes. Try a shorter prompt.'
        });

    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate video' });
    }
}
