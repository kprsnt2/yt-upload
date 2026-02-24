// Video generation using Vercel AI SDK + AI Gateway
// Primary: xai/grok-imagine-video | Fallback: alibaba/wan-v2.6-r2v
import { experimental_generateVideo as generateVideo } from 'ai';
import { gateway } from '@ai-sdk/gateway';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, aspectRatio = '9:16', duration = 5, style = '' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const fullPrompt = style
            ? `${prompt}, ${style} style, high quality, cinematic`
            : `${prompt}, high quality, cinematic`;

        let result = null;
        let usedModel = '';

        // Try primary model: xai/grok-imagine-video
        try {
            console.log('Trying xai/grok-imagine-video...');
            result = await generateVideo({
                model: gateway('xai/grok-imagine-video'),
                prompt: fullPrompt,
                providerOptions: {
                    gateway: {
                        aspectRatio,
                        duration: String(duration),
                    },
                },
            });
            usedModel = 'xai/grok-imagine-video';
        } catch (err) {
            console.warn('Primary model failed:', err.message);
        }

        // Fallback: alibaba/wan-v2.6-r2v
        if (!result) {
            try {
                console.log('Trying alibaba/wan-v2.6-r2v...');
                result = await generateVideo({
                    model: gateway('alibaba/wan-v2.6-r2v'),
                    prompt: fullPrompt,
                    providerOptions: {
                        gateway: {
                            aspectRatio,
                            duration: String(duration),
                        },
                    },
                });
                usedModel = 'alibaba/wan-v2.6-r2v';
            } catch (err) {
                console.warn('Fallback model failed:', err.message);
            }
        }

        if (!result || !result.video) {
            return res.status(500).json({
                error: 'Video generation failed on all models. Please try again later.'
            });
        }

        // The result.video contains the video data
        // Convert to base64 for frontend consumption
        const videoData = result.video;
        let base64Data;

        if (videoData.base64) {
            base64Data = videoData.base64;
        } else if (videoData.uint8Array) {
            base64Data = Buffer.from(videoData.uint8Array).toString('base64');
        } else if (typeof videoData === 'string') {
            // URL-based result
            return res.json({
                success: true,
                video: {
                    data: videoData,
                    mimeType: 'video/mp4',
                    model: usedModel,
                    prompt: fullPrompt,
                }
            });
        }

        res.json({
            success: true,
            video: {
                data: `data:video/mp4;base64,${base64Data}`,
                mimeType: 'video/mp4',
                model: usedModel,
                prompt: fullPrompt,
            }
        });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate video' });
    }
}
