// Image generation using Pollinations.ai (free, no API key needed)
// Uses Flux model for high quality AI image generation

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, count = 6, style = 'vibrant', aspectRatio = '9:16' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const width = aspectRatio === '16:9' ? 1280 : 720;
        const height = aspectRatio === '16:9' ? 720 : 1280;

        const styleGuides = {
            vibrant: 'ultra vibrant colors, high contrast, visually stunning, eye-catching',
            cinematic: 'cinematic lighting, dramatic atmosphere, film quality, 4K',
            artistic: 'digital art, beautiful illustration, trending on artstation, masterpiece',
            realistic: 'photorealistic, ultra HD, detailed, natural lighting, professional photography',
            anime: 'anime style, vibrant colors, detailed illustration, studio quality anime art',
            devotional: 'divine atmosphere, golden light, spiritual, sacred art, traditional Indian art',
            folk: 'traditional folk art style, colorful, rural Indian aesthetics, earthy tones'
        };
        const styleGuide = styleGuides[style] || styleGuides.vibrant;

        // Generate images using Pollinations.ai — free Flux model, no API key needed
        const batchSize = 3;
        const images = [];

        for (let b = 0; b < count; b += batchSize) {
            const batchCount = Math.min(batchSize, count - b);
            const batch = Array.from({ length: batchCount }, async (_, idx) => {
                const i = b + idx;
                const scenePrompt = `${prompt}, scene ${i + 1} of ${count}, ${styleGuide}, high quality, detailed`;
                const seed = Math.floor(Math.random() * 999999) + i;
                const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(scenePrompt)}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;

                try {
                    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    const base64 = buffer.toString('base64');
                    const mimeType = response.headers.get('content-type') || 'image/jpeg';
                    return {
                        id: `img-${Date.now()}-${i}`,
                        data: `data:${mimeType};base64,${base64}`,
                        prompt: scenePrompt,
                        source: 'pollinations'
                    };
                } catch (err) {
                    console.warn(`Image ${i + 1} failed:`, err.message);
                    return null;
                }
            });

            const results = await Promise.all(batch);
            images.push(...results.filter(Boolean));
        }

        if (images.length === 0) {
            return res.status(500).json({ error: 'All image generation attempts failed. Please try again.' });
        }

        res.json({ success: true, images });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate images' });
    }
}
