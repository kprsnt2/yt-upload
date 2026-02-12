import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    try {
        const { prompt, count = 6, style = 'vibrant', aspectRatio = '9:16' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

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

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: { responseModalities: ['Text', 'Image'] }
        });

        const images = [];

        for (let i = 0; i < count; i++) {
            try {
                const scenePrompt = `Generate scene ${i + 1} of ${count} for a video: ${prompt}. ${styleGuide}. 
          Make each scene visually distinct but thematically connected. 
          Aspect ratio: ${aspectRatio}. High quality, suitable for YouTube video.`;

                const result = await model.generateContent(scenePrompt);
                const response = result.response;

                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            images.push({
                                id: `img-${Date.now()}-${i}`,
                                data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                                prompt: scenePrompt,
                                source: 'gemini'
                            });
                        }
                    }
                }

                // Rate limit delay
                if (i < count - 1) await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                console.warn(`Image ${i + 1} failed:`, err.message);
            }
        }

        res.json({ success: true, images });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate images' });
    }
}
