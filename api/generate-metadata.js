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
        const { topic, format = 'short' } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic is required' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a YouTube SEO expert specializing in Telugu/Indian content.
Generate optimized YouTube metadata for a ${format === 'short' ? 'YouTube Short' : 'regular YouTube video'}.

Topic: "${topic}"
Channel: sujathananammavlogs

Generate in BOTH English and Telugu:
1. title_en: Catchy YouTube title in English (with emojis, max 100 chars, click-worthy)
2. title_te: Same title in Telugu
3. description_en: Full YouTube description in English (300-500 words) with hashtags, CTA
4. description_te: Same in Telugu
5. tags: Array of 20-30 tags mixing English and Telugu
6. category: Best YouTube category
7. thumbnail_text: Short text for thumbnail (max 5 words)
8. thumbnail_text_te: Same in Telugu

Return as JSON. Return ONLY the JSON, no markdown.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const metadata = JSON.parse(cleanText);

        res.json({ success: true, metadata });
    } catch (error) {
        console.error('Metadata error:', error);
        // Return basic defaults
        const { topic = 'video', format = 'short' } = req.body || {};
        res.json({
            success: true,
            metadata: {
                title_en: `${topic} ✨ #shorts`,
                title_te: `${topic} ✨`,
                description_en: `${topic}\n\nWelcome to Sujatha Nanamma Vlogs! 🙏\n\n#telugu #viral #trending\n\n👍 Like, 🔔 Subscribe!`,
                description_te: `${topic}\n\nసుజాతా నానమ్మ వ్లాగ్స్ 🙏\n\n#telugu #trending`,
                tags: ['telugu', 'viral', 'trending', 'shorts', 'sujathananammavlogs'],
                category: 'Entertainment',
                thumbnail_text: topic.split(' ').slice(0, 4).join(' '),
                thumbnail_text_te: topic
            }
        });
    }
}
