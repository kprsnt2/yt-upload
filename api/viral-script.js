import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    try {
        const { idea, format = 'short', imageCount = 8 } = req.body;
        if (!idea) return res.status(400).json({ error: 'Idea is required' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const totalDuration = format === 'short' ? 60 : 180;
        const secondsPerImage = Math.floor(totalDuration / imageCount);

        const prompt = `You are a visual storytelling expert for YouTube. Create a ${format === 'short' ? 'Short (60 seconds)' : 'regular video (2-3 minutes)'} script.

Video idea: "${idea}"
Number of scenes/images: ${imageCount}
Duration per scene: ~${secondsPerImage} seconds
Channel: sujathananammavlogs (Telugu/Indian culture)

For each scene, provide:
1. sceneNumber (1 to ${imageCount})
2. imagePrompt (detailed prompt for AI image generation - be VERY specific about visual elements, colors, composition, lighting)
3. narration (optional text overlay in English)
4. narrationTelugu (same in Telugu)
5. duration (in seconds)
6. transition (fade/zoom/slide)

Also provide:
- overallTitle (catchy YouTube title)
- overallTitleTelugu (Telugu translation)
- description (YouTube description in English, 300-500 words)
- descriptionTelugu (Telugu translation)
- tags (array of 15-20 relevant YouTube tags in English and Telugu)
- suggestedMusicMood (overall mood for background music)
- thumbnailPrompt (detailed AI image prompt for a clickbait-worthy thumbnail)

Return as JSON with fields: scenes (array), overallTitle, overallTitleTelugu, description, descriptionTelugu, tags, suggestedMusicMood, thumbnailPrompt.
Return ONLY the JSON, no markdown formatting.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const script = JSON.parse(cleanText);

        res.json({ success: true, script });
    } catch (error) {
        console.error('Script generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate script' });
    }
}
