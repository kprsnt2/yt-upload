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
        const { prompt, count = 6, style = 'vibrant', aspectRatio = '9:16' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

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

        const images = [];

        // Generate images sequentially to avoid rate limits
        for (let i = 0; i < count; i++) {
            const scenePrompt = `${prompt}, scene ${i + 1} of ${count}, ${styleGuide}, high quality, detailed, 8k`;
            const seed = Math.floor(Math.random() * 4294967295);

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
                        cfg_scale: 7,
                        sampler: 'K_DPM_2_ANCESTRAL',
                        seed: seed,
                        steps: 25,
                        width: aspectRatio === '16:9' ? 1344 : 1024,
                        height: aspectRatio === '16:9' ? 768 : 1024,
                    }),
                    signal: AbortSignal.timeout(30000),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn(`NVIDIA API error for image ${i + 1}:`, response.status, errorText);

                    // If rate limited, wait and retry once
                    if (response.status === 429) {
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    continue;
                }

                const data = await response.json();

                if (data.artifacts && data.artifacts.length > 0) {
                    const artifact = data.artifacts[0];
                    images.push({
                        id: `img-${Date.now()}-${i}`,
                        data: `data:image/png;base64,${artifact.base64}`,
                        prompt: scenePrompt,
                        source: 'nvidia-sdxl',
                        seed: artifact.seed || seed,
                    });
                }

                // Small delay between requests to avoid rate limits
                if (i < count - 1) await new Promise(r => setTimeout(r, 300));

            } catch (err) {
                console.warn(`Image ${i + 1} generation failed:`, err.message);
            }
        }

        if (images.length === 0) {
            return res.status(500).json({
                error: 'No images could be generated. Please check your NVIDIA API key and credits at build.nvidia.com'
            });
        }

        res.json({ success: true, images });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate images' });
    }
}
