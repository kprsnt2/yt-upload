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
        const { niche = 'telugu culture', count = 5 } = req.body;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a YouTube viral content strategist specializing in Indian/Telugu content.
Generate ${count} viral video ideas for a YouTube channel focused on "${niche}".

The channel "sujathananammavlogs" creates visual content with AI-generated images/videos and background music.

For each idea, provide:
1. Title (catchy, emoji-included, viral-worthy)
2. Hook (first 3 seconds concept to grab attention)
3. Theme/Topic
4. Why it would go viral (psychology behind it)
5. Suggested music mood (folk/devotional/cinematic/upbeat)
6. Target audience
7. Best format (Short/Long)

Focus on:
- Trending topics in Telugu/Indian culture
- Emotional storytelling (nostalgia, pride, spirituality)
- Visual spectacles (festivals, nature, mythology)
- Relatable daily life content
- Cultural heritage and traditions

Return as a JSON array with fields: title, hook, theme, viralReason, musicMood, audience, format.
Return ONLY the JSON array, no markdown formatting.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const ideas = JSON.parse(cleanText);

        res.json({ success: true, ideas });
    } catch (error) {
        console.error('Viral ideas error:', error);

        // Return defaults on failure
        res.json({
            success: true,
            ideas: [
                { title: "🏡 Telugu Village Life That City People Will Never Understand! 😱", hook: "Stunning village sunrise imagery", theme: "Rural Telugu lifestyle", viralReason: "Nostalgia drives engagement", musicMood: "folk", audience: "Telugu diaspora", format: "Short" },
                { title: "🪔 Why Sankranti Is The GREATEST Festival! ✨", hook: "Colorful rangoli time-lapse", theme: "Telugu festival celebration", viralReason: "Cultural pride + spectacle", musicMood: "upbeat", audience: "Telugu community", format: "Long" },
                { title: "🌾 Secret Behind Telugu Grandma's Cooking 🍲❤️", hook: "Steaming traditional dish closeup", theme: "Traditional cuisine", viralReason: "Food content + emotion", musicMood: "devotional", audience: "Food lovers", format: "Short" },
                { title: "🎭 Ancient Art Forms Disappearing Forever! 😢", hook: "Dramatic art reveal", theme: "Cultural heritage", viralReason: "Urgency + preservation", musicMood: "cinematic", audience: "Art lovers", format: "Long" },
                { title: "⛰️ 10 HIDDEN Places You MUST Visit! 🗺️", hook: "Aerial breathtaking landscape", theme: "Travel in AP & Telangana", viralReason: "Discovery + beautiful visuals", musicMood: "upbeat", audience: "Travel enthusiasts", format: "Long" }
            ]
        });
    }
}
