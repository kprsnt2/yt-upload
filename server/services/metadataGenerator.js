import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generate YouTube metadata: title, description, tags
 * In both English and Telugu
 */
export async function generateMetadata(topic, format = 'short', language = 'both') {
    if (!process.env.GEMINI_API_KEY) {
        return getDefaultMetadata(topic, format);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are a YouTube SEO expert specializing in Telugu/Indian content.
Generate optimized YouTube metadata for a ${format === 'short' ? 'YouTube Short' : 'regular YouTube video'}.

Topic: "${topic}"
Channel: sujathananammavlogs

Generate the following in BOTH English and Telugu:

1. title_en: Catchy YouTube title in English (with emojis, max 100 chars). Should be click-worthy and SEO optimized.
2. title_te: Same title translated to Telugu
3. description_en: Full YouTube description in English (300-500 words):
   - First 2 lines are the hook (visible before "show more")
   - Include relevant hashtags
   - Include call-to-action (subscribe, like, comment)
   - Include related keywords naturally
4. description_te: Same description in Telugu
5. tags: Array of 20-30 tags mixing English and Telugu, including:
   - Topic-specific tags
   - Trending tags in Telugu YouTube
   - General viral tags
   - Channel-specific tags
6. category: Best YouTube category (e.g., "Entertainment", "People & Blogs")
7. thumbnail_text: Short text to overlay on thumbnail (max 5 words)
8. thumbnail_text_te: Same in Telugu

Return as JSON with fields: title_en, title_te, description_en, description_te, tags, category, thumbnail_text, thumbnail_text_te.
Return ONLY the JSON, no markdown formatting.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanText);
    } catch (err) {
        console.error('Metadata generation failed:', err.message);
        return getDefaultMetadata(topic, format);
    }
}

function getDefaultMetadata(topic, format) {
    const isShort = format === 'short';
    return {
        title_en: `${topic} | Amazing Visual Story ✨ #shorts`,
        title_te: `${topic} | అద్భుతమైన విజువల్ స్టోరీ ✨`,
        description_en: `${topic}\n\nWelcome to Sujatha Nanamma Vlogs! 🙏\n\nIn this ${isShort ? 'short' : 'video'}, we bring you an amazing visual experience about ${topic}.\n\n#${topic.replace(/\s+/g, '')} #telugu #viral #trending\n\n👍 Like, 🔔 Subscribe & Share!\n\nFollow us for more amazing content!`,
        description_te: `${topic}\n\nసుజాతా నానమ్మ వ్లాగ్స్ కి స్వాగతం! 🙏\n\n#telugu #trending #viral`,
        tags: ['telugu', 'viral', 'trending', 'shorts', topic.toLowerCase(), 'sujathananammavlogs', 'telugu vlogs'],
        category: 'Entertainment',
        thumbnail_text: topic.split(' ').slice(0, 4).join(' '),
        thumbnail_text_te: topic
    };
}
