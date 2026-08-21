import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, '..', 'output');

/**
 * Initialize Google GenAI client for Vertex AI or Gemini Developer API
 */
export function getGenAIClient() {
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

/**
 * Generate video using Google Vertex AI / Veo API
 */
export async function generateVeoVideo({
    prompt,
    style = 'cinematic',
    aspectRatio = '9:16',
    duration = 5,
    model: requestedModel = null
}) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error('A valid prompt is required for video generation.');
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

    // Map aspect ratio to standard formats: "9:16", "16:9", "1:1"
    let formattedAspectRatio = '9:16';
    if (aspectRatio === '16:9' || aspectRatio === 'landscape' || aspectRatio === 'long') {
        formattedAspectRatio = '16:9';
    } else if (aspectRatio === '1:1' || aspectRatio === 'square') {
        formattedAspectRatio = '1:1';
    }

    console.log(`[Veo] Starting video generation with model: ${targetModel}`);
    console.log(`[Veo] Aspect ratio: ${formattedAspectRatio}, Duration: ${duration}s`);
    console.log(`[Veo] Prompt: "${fullPrompt}"`);

    // Initiate long-running video generation operation
    let operation;
    try {
        operation = await client.models.generateVideos({
            model: targetModel,
            prompt: fullPrompt,
            config: {
                aspectRatio: formattedAspectRatio,
                durationSeconds: Number(duration) || 5,
                personGeneration: 'ALLOW_ADULT'
            }
        });
    } catch (initError) {
        console.error('[Veo] Error initiating generateVideos:', initError);
        throw new Error(`Failed to initiate Veo video generation: ${initError.message || initError}`);
    }

    if (!operation || !operation.name) {
        throw new Error('Invalid response from Veo API: Operation name not returned.');
    }

    console.log(`[Veo] Operation started: ${operation.name}`);

    // Poll for operation completion (max 5 minutes)
    const maxWaitMs = 5 * 60 * 1000;
    const pollIntervalMs = 10 * 1000;
    const startTime = Date.now();

    while (!operation.done) {
        if (Date.now() - startTime > maxWaitMs) {
            throw new Error('Video generation timed out after 5 minutes.');
        }

        console.log(`[Veo] Polling operation status (${Math.round((Date.now() - startTime) / 1000)}s elapsed)...`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        try {
            operation = await client.operations.getVideosOperation({ operation });
        } catch (pollError) {
            console.warn('[Veo] Polling error (retrying):', pollError.message);
        }
    }

    if (operation.error) {
        const errMsg = typeof operation.error === 'object' ? JSON.stringify(operation.error) : operation.error;
        console.error('[Veo] Operation finished with error:', errMsg);
        throw new Error(`Veo video generation failed: ${errMsg}`);
    }

    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
        throw new Error('No generated video returned in Veo operation response.');
    }

    const firstVideo = generatedVideos[0]?.video || generatedVideos[0];
    let base64Data = '';
    let mimeType = firstVideo?.mimeType || 'video/mp4';
    let videoUrl = '';

    if (firstVideo?.videoBytes) {
        // Video bytes Buffer/Uint8Array/String
        const buffer = Buffer.isBuffer(firstVideo.videoBytes)
            ? firstVideo.videoBytes
            : Buffer.from(firstVideo.videoBytes);
        base64Data = buffer.toString('base64');

        // Save copy to output directory
        const videoId = `veo-${Date.now()}-${uuidv4().substring(0, 8)}.mp4`;
        const filePath = path.join(outputDir, videoId);
        fs.writeFileSync(filePath, buffer);
        videoUrl = `/output/${videoId}`;
    } else if (firstVideo?.uri) {
        videoUrl = firstVideo.uri;
        // If it is an HTTP URL, fetch it to also get base64
        if (firstVideo.uri.startsWith('http')) {
            try {
                const fetched = await fetch(firstVideo.uri);
                if (fetched.ok) {
                    const arrayBuf = await fetched.arrayBuffer();
                    const buffer = Buffer.from(arrayBuf);
                    base64Data = buffer.toString('base64');
                    const videoId = `veo-${Date.now()}-${uuidv4().substring(0, 8)}.mp4`;
                    const filePath = path.join(outputDir, videoId);
                    fs.writeFileSync(filePath, buffer);
                    videoUrl = `/output/${videoId}`;
                }
            } catch (fetchErr) {
                console.warn('[Veo] Could not fetch video URI for local caching:', fetchErr.message);
            }
        }
    }

    const dataUrl = base64Data ? `data:${mimeType};base64,${base64Data}` : videoUrl;

    return {
        success: true,
        video: {
            data: dataUrl,
            url: videoUrl,
            mimeType,
            model: targetModel,
            prompt: fullPrompt,
            operationName: operation.name
        }
    };
}
