// Video generation using Google Vertex AI / Veo API via @google/genai SDK
// Supports Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true, VERTEX_PROJECT_ID, VERTEX_LOCATION)
// and Google AI Studio (GEMINI_API_KEY)
import { GoogleGenAI } from '@google/genai';

function getGenAIClient() {
    const isVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' ||
                       Boolean(process.env.VERTEX_PROJECT_ID) ||
                       Boolean(process.env.GOOGLE_CLOUD_PROJECT);

    if (isVertexAI) {
        const project = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
        const location = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        return new GoogleGenAI({
            vertexAI: true,
            project,
            location
        });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error(
            'Missing API credentials. Set GEMINI_API_KEY for Google AI Studio, or VERTEX_PROJECT_ID (with GOOGLE_GENAI_USE_VERTEXAI=true) for Vertex AI.'
        );
    }

    return new GoogleGenAI({ apiKey });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const {
            prompt,
            aspectRatio = '9:16',
            duration = 5,
            style = 'cinematic',
            model: requestedModel = null
        } = req.body || {};

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ error: 'A valid prompt is required for video generation.' });
        }

        const styleGuides = {
            cinematic: 'cinematic lighting, 4K resolution, photorealistic, dramatic movie atmosphere',
            vibrant: 'vibrant colors, high dynamic range, crisp details, visually stunning',
            artistic: 'digital art, beautiful illustration, painterly, masterpiece quality',
            realistic: 'ultra photorealistic, natural lighting, lifelike motion, 4k footage',
            devotional: 'divine golden light, spiritual aura, sacred, peaceful atmosphere',
            folk: 'traditional Indian folk aesthetics, cultural, rich textures, earthy tones',
            anime: 'high-quality anime animation, dynamic camera, vibrant animation style'
        };

        const styleGuide = styleGuides[style] || (style ? `${style} style` : 'cinematic lighting, 4k resolution');
        const fullPrompt = `${prompt.trim()}, ${styleGuide}`;

        const client = getGenAIClient();
        const targetModel = requestedModel || process.env.VEO_MODEL || 'veo-2.0-generate-001';

        // Map aspect ratio to "9:16", "16:9", "1:1"
        let formattedAspectRatio = '9:16';
        if (aspectRatio === '16:9' || aspectRatio === 'landscape' || aspectRatio === 'long') {
            formattedAspectRatio = '16:9';
        } else if (aspectRatio === '1:1' || aspectRatio === 'square') {
            formattedAspectRatio = '1:1';
        }

        console.log(`[Veo API] Generating video with model: ${targetModel}`);
        console.log(`[Veo API] Aspect ratio: ${formattedAspectRatio}, Duration: ${duration}s`);
        console.log(`[Veo API] Prompt: "${fullPrompt}"`);

        // Initiate long-running video generation operation
        let operation = await client.models.generateVideos({
            model: targetModel,
            prompt: fullPrompt,
            config: {
                aspectRatio: formattedAspectRatio,
                durationSeconds: Number(duration) || 5,
                personGeneration: 'ALLOW_ADULT'
            }
        });

        if (!operation || !operation.name) {
            return res.status(500).json({ error: 'Veo API did not return an operation name.' });
        }

        console.log(`[Veo API] Operation started: ${operation.name}`);

        // Poll for operation completion (max 2 minutes for serverless limit)
        const maxWaitMs = 110 * 1000;
        const pollIntervalMs = 8 * 1000;
        const startTime = Date.now();

        while (!operation.done) {
            if (Date.now() - startTime > maxWaitMs) {
                return res.status(504).json({
                    error: 'Video generation is taking longer than expected. Please try again or use a shorter duration.'
                });
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

            try {
                operation = await client.operations.getVideosOperation({ operation });
            } catch (pollError) {
                console.warn('[Veo API] Polling status retry:', pollError.message);
            }
        }

        if (operation.error) {
            const errMsg = typeof operation.error === 'object' ? JSON.stringify(operation.error) : operation.error;
            console.error('[Veo API] Generation operation failed:', errMsg);
            return res.status(500).json({ error: `Veo video generation failed: ${errMsg}` });
        }

        const generatedVideos = operation.response?.generatedVideos;
        if (!generatedVideos || generatedVideos.length === 0) {
            return res.status(500).json({ error: 'No video was generated by Veo API.' });
        }

        const firstVideo = generatedVideos[0]?.video || generatedVideos[0];
        let base64Data = '';
        const mimeType = firstVideo?.mimeType || 'video/mp4';

        if (firstVideo?.videoBytes) {
            const buffer = Buffer.isBuffer(firstVideo.videoBytes)
                ? firstVideo.videoBytes
                : Buffer.from(firstVideo.videoBytes);
            base64Data = buffer.toString('base64');
        } else if (firstVideo?.uri) {
            if (firstVideo.uri.startsWith('http')) {
                try {
                    const fetched = await fetch(firstVideo.uri);
                    if (fetched.ok) {
                        const arrayBuf = await fetched.arrayBuffer();
                        base64Data = Buffer.from(arrayBuf).toString('base64');
                    }
                } catch (fetchErr) {
                    console.warn('[Veo API] Could not fetch video URI for base64 conversion:', fetchErr.message);
                    return res.json({
                        success: true,
                        video: {
                            data: firstVideo.uri,
                            mimeType,
                            model: targetModel,
                            prompt: fullPrompt,
                            operationName: operation.name
                        }
                    });
                }
            } else {
                return res.json({
                    success: true,
                    video: {
                        data: firstVideo.uri,
                        mimeType,
                        model: targetModel,
                        prompt: fullPrompt,
                        operationName: operation.name
                    }
                });
            }
        }

        if (!base64Data) {
            return res.status(500).json({ error: 'Could not extract generated video data from response.' });
        }

        return res.json({
            success: true,
            video: {
                data: `data:${mimeType};base64,${base64Data}`,
                mimeType,
                model: targetModel,
                prompt: fullPrompt,
                operationName: operation.name
            }
        });

    } catch (error) {
        console.error('[Veo API] Server error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error during video generation.' });
    }
}
