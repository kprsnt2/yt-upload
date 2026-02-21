// Image generation using NVIDIA NIM API (Stable Diffusion XL)
// Requires NVIDIA_API_KEY environment variable

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'NVIDIA_API_KEY not configured. Add it in Vercel Environment Variables.' });

    try {
        const { prompt, count = 6, style = 'vibrant', aspectRatio = '9:16', model = 'balanced' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const modelProfiles = {
            cheap: {
                id: 'cheap',
                name: 'Cheap (Fast Draft)',
                description: 'Lowest cost profile with faster generations and good draft quality.',
                steps: 18,
                cfgScale: 6,
                sampler: 'K_EULER_ANCESTRAL',
            },
            balanced: {
                id: 'balanced',
                name: 'Balanced (Recommended)',
                description: 'Good quality/cost balance for most YouTube scenes.',
                steps: 25,
                cfgScale: 7,
                sampler: 'K_DPM_2_ANCESTRAL',
            },
            best: {
                id: 'best',
                name: 'Best (Quality)',
                description: 'Highest visual quality profile for hero shots and thumbnails.',
                steps: 32,
                cfgScale: 8,
                sampler: 'K_DPM_2_ANCESTRAL',
            }
        };

        const selectedModel = modelProfiles[model] || modelProfiles.balanced;

        const styleGuides = {
            vibrant: 'ultra vibrant colors, high contrast, visually stunning, eye-catching, professional quality',
            cinematic: 'cinematic lighting, dramatic atmosphere, film quality, 4K resolution, movie poster style',
            artistic: 'digital art, beautiful illustration, trending on artstation, masterpiece quality',
            realistic: 'photorealistic, ultra HD, detailed, natural lighting, professional photography',
            anime: 'anime style, vibrant colors, detailed illustration, studio quality anime art',
            devotional: 'divine atmosphere, golden light, spiritual, sacred art, traditional Indian art style',
            folk: 'traditional folk art style, colorful, rural Indian aesthetics, earthy tones, cultural'
        };
        const styleGuide = styleGuides[style] || styleGuides.vibrant;

        // NVIDIA SDXL endpoint enforces width >= 1024 and height <= 1024.
        // For portrait requests we use 1024x1024 as the closest supported fallback.
        const dimensions = aspectRatio === '16:9'
            ? { width: 1344, height: 768 }
            : { width: 1024, height: 1024 };

        const images = [];
        const generationErrors = [];

        const parseNvidiaError = (status, rawBody) => {
            const bodyText = (rawBody || '').trim();
            let parsed;

            try {
                parsed = JSON.parse(bodyText);
            } catch {
                parsed = null;
            }

            const providerMessage = parsed?.detail || parsed?.error || parsed?.message || bodyText;

            if (status === 401 || status === 403) {
                return `NVIDIA rejected the API key (${status}). Check NVIDIA_API_KEY permissions.`;
            }
            if (status === 402) {
                return 'NVIDIA credits are exhausted (402 Payment Required). Add credits in build.nvidia.com.';
            }
            if (status === 422) {
                return `NVIDIA rejected the request as invalid (422). ${providerMessage || 'Please simplify the prompt or adjust generation parameters.'}`;
            }
            if (status === 429) {
                return 'NVIDIA rate limit reached (429). Please retry in a few seconds.';
            }
            if (status >= 500) {
                return `NVIDIA service error (${status}). ${providerMessage || 'Temporary provider issue.'}`;
            }

            return `NVIDIA request failed (${status}). ${providerMessage || 'Unknown provider error.'}`;
        };

        // Generate images sequentially to avoid rate limits
        for (let i = 0; i < count; i++) {
            const scenePrompt = `${prompt}, scene ${i + 1} of ${count}, ${styleGuide}, high quality, detailed, 8k`;
            const seed = Math.floor(Math.random() * 4294967295);

            let imageGenerated = false;

            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const response = await fetch('https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            text_prompts: [
                                { text: scenePrompt, weight: 1 },
                                { text: 'blurry, low quality, distorted, watermark, text, ugly, deformed', weight: -1 }
                            ],
                            cfg_scale: selectedModel.cfgScale,
                            sampler: selectedModel.sampler,
                            seed: seed,
                            steps: selectedModel.steps,
                            width: dimensions.width,
                            height: dimensions.height,
                        }),
                        signal: AbortSignal.timeout(30000),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        const message = parseNvidiaError(response.status, errorText);
                        console.warn(`NVIDIA API error for image ${i + 1} (attempt ${attempt}):`, response.status, errorText);

                        if (response.status === 429 && attempt < 2) {
                            await new Promise(r => setTimeout(r, 2000));
                            continue;
                        }

                        generationErrors.push({ image: i + 1, attempt, status: response.status, message });
                        break;
                    }

                    const data = await response.json();

                    if (data.artifacts && data.artifacts.length > 0) {
                        const artifact = data.artifacts[0];
                        images.push({
                            id: `img-${Date.now()}-${i}`,
                            data: `data:image/png;base64,${artifact.base64}`,
                            prompt: scenePrompt,
                            source: 'nvidia-sdxl',
                            model: selectedModel.id,
                            seed: artifact.seed || seed,
                        });
                        imageGenerated = true;
                        break;
                    }

                    generationErrors.push({
                        image: i + 1,
                        attempt,
                        message: 'NVIDIA returned success but no image artifacts.'
                    });
                    break;

                } catch (err) {
                    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
                    const message = isTimeout
                        ? 'Request to NVIDIA timed out after 30s. Try a shorter prompt or retry.'
                        : `Network/Runtime error calling NVIDIA: ${err.message}`;

                    console.warn(`Image ${i + 1} generation failed on attempt ${attempt}:`, err.message);
                    generationErrors.push({ image: i + 1, attempt, message });

                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 1200));
                        continue;
                    }
                }
            }

            // Small delay between requests to avoid rate limits
            if (!imageGenerated && i < count - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        if (images.length === 0) {
            return res.status(500).json({
                error: generationErrors[0]?.message || 'No images could be generated from NVIDIA API.',
                details: generationErrors
            });
        }

        res.json({
            success: true,
            model: {
                id: selectedModel.id,
                name: selectedModel.name,
                description: selectedModel.description,
                providerModel: 'stabilityai/stable-diffusion-xl',
            },
            images
        });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate images' });
    }
}
