import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp');

/**
 * Generate AI images using Gemini API (free tier: 500/day)
 * Falls back to Hugging Face if Gemini fails
 */
export async function generateImages(prompt, count = 6, style = 'vibrant', aspectRatio = '9:16') {
    const enhancedPrompt = buildImagePrompt(prompt, style);
    const images = [];

    // Try Gemini first
    if (process.env.GEMINI_API_KEY) {
        try {
            const geminiImages = await generateWithGemini(enhancedPrompt, count, aspectRatio);
            if (geminiImages.length > 0) return geminiImages;
        } catch (err) {
            console.warn('Gemini image generation failed, trying fallback:', err.message);
        }
    }

    // Fallback to Hugging Face (free, no key needed for some models)
    try {
        const hfImages = await generateWithHuggingFace(enhancedPrompt, count);
        if (hfImages.length > 0) return hfImages;
    } catch (err) {
        console.warn('Hugging Face fallback also failed:', err.message);
    }

    throw new Error('All image generation services failed. Please check your API keys.');
}

function buildImagePrompt(prompt, style) {
    const styleGuides = {
        vibrant: 'ultra vibrant colors, high contrast, visually stunning, eye-catching, professional quality',
        cinematic: 'cinematic lighting, dramatic atmosphere, film-quality, 4K resolution, movie poster style',
        artistic: 'digital art, beautiful illustration, trending on artstation, masterpiece quality',
        realistic: 'photorealistic, ultra HD, detailed, natural lighting, professional photography',
        anime: 'anime style, vibrant colors, detailed illustration, studio quality anime art',
        devotional: 'divine atmosphere, golden light, spiritual, sacred art, traditional Indian art style',
        folk: 'traditional folk art style, colorful, rural Indian aesthetics, earthy tones, cultural'
    };

    const styleGuide = styleGuides[style] || styleGuides.vibrant;
    return `${prompt}. Style: ${styleGuide}. High quality, detailed, suitable for YouTube video.`;
}

async function generateWithGemini(prompt, count, aspectRatio) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
            responseModalities: ['Text', 'Image']
        }
    });

    const images = [];

    // Generate images one at a time (Gemini generates 1 image per request)
    for (let i = 0; i < count; i++) {
        try {
            const scenePrompt = `Generate scene ${i + 1} of ${count} for a video: ${prompt}. 
        Make each scene visually distinct but thematically connected and story-like. 
        Aspect ratio: ${aspectRatio}. Scene ${i + 1} should show a different angle or moment.`;

            const result = await model.generateContent(scenePrompt);
            const response = result.response;

            // Extract image from multimodal response
            if (response.candidates && response.candidates[0]) {
                const parts = response.candidates[0].content.parts;
                for (const part of parts) {
                    if (part.inlineData) {
                        const imageId = uuidv4();
                        const imagePath = path.join(tempDir, `${imageId}.png`);
                        const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                        fs.writeFileSync(imagePath, imageBuffer);
                        images.push({
                            id: imageId,
                            url: `/temp/${imageId}.png`,
                            prompt: scenePrompt,
                            source: 'gemini'
                        });
                    }
                }
            }

            // Small delay to respect rate limits
            if (i < count - 1) await sleep(500);
        } catch (err) {
            console.warn(`Gemini image ${i + 1} failed:`, err.message);
        }
    }

    return images;
}

async function generateWithHuggingFace(prompt, count) {
    const images = [];
    const HF_API = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

    for (let i = 0; i < count; i++) {
        try {
            const scenePrompt = `Scene ${i + 1}: ${prompt}`;
            const response = await fetch(HF_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: scenePrompt })
            });

            if (response.ok) {
                const imageBuffer = Buffer.from(await response.arrayBuffer());
                const imageId = uuidv4();
                const imagePath = path.join(tempDir, `${imageId}.png`);
                fs.writeFileSync(imagePath, imageBuffer);
                images.push({
                    id: imageId,
                    url: `/temp/${imageId}.png`,
                    prompt: scenePrompt,
                    source: 'huggingface'
                });
            }

            if (i < count - 1) await sleep(2000); // HF has stricter rate limits
        } catch (err) {
            console.warn(`HF image ${i + 1} failed:`, err.message);
        }
    }

    return images;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
