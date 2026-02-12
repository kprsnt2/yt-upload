import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generate viral video ideas using Gemini AI
 * Researches trending topics and suggests high-engagement content
 */
export async function generateViralIdeas(niche = 'telugu culture', count = 5) {
    if (!process.env.GEMINI_API_KEY) {
        return getDefaultViralIdeas(niche);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse JSON from response
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const ideas = JSON.parse(cleanText);
        return ideas;
    } catch (err) {
        console.error('Viral ideas generation failed:', err.message);
        return getDefaultViralIdeas(niche);
    }
}

/**
 * Generate a full viral script with scene-by-scene descriptions for image generation
 */
export async function generateViralScript(idea, format = 'short', imageCount = 8) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API key required for script generation');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
2. imagePrompt (detailed prompt for AI image generation - be VERY specific about visual elements, colors, composition, lighting. This will be used directly to generate an image)
3. narration (optional text overlay or voiceover in English)
4. narrrationTelugu (same in Telugu)
5. duration (in seconds)
6. transition (fade/zoom/slide)
7. musicIntensity (low/medium/high - for dynamic music matching)

Also provide:
- overallTitle (catchy YouTube title)
- overallTitleTelugu (Telugu translation)
- description (YouTube description in English)
- descriptionTelugu (Telugu translation)
- tags (array of 15-20 relevant YouTube tags in English and Telugu)
- suggestedMusicMood (overall mood for background music)
- thumbnailPrompt (detailed AI image prompt for a clickbait-worthy thumbnail)

Return as JSON with fields: scenes (array), overallTitle, overallTitleTelugu, description, descriptionTelugu, tags, suggestedMusicMood, thumbnailPrompt.
Return ONLY the JSON, no markdown formatting.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanText);
    } catch (err) {
        console.error('Script generation failed:', err.message);
        throw new Error(`Script generation failed: ${err.message}`);
    }
}

function getDefaultViralIdeas(niche) {
    return [
        {
            title: "🏡 Telugu Village Life That City People Will Never Understand! 😱",
            hook: "Open with stunning village sunrise imagery",
            theme: "Rural Telugu lifestyle nostalgia",
            viralReason: "Nostalgia + urban vs rural contrast drives engagement",
            musicMood: "folk",
            audience: "Telugu diaspora, NRIs, youth",
            format: "Short"
        },
        {
            title: "🪔 Why Sankranti Is The GREATEST Festival Ever! ✨",
            hook: "Colorful rangoli time-lapse opening",
            theme: "Telugu festival celebration",
            viralReason: "Cultural pride + visual spectacle",
            musicMood: "upbeat",
            audience: "Telugu community worldwide",
            format: "Long"
        },
        {
            title: "🌾 The Secret Behind Telugu Grandma's Cooking 🍲❤️",
            hook: "Close-up of steaming traditional dish",
            theme: "Traditional Telugu cuisine",
            viralReason: "Food content + emotional grandmother narrative",
            musicMood: "devotional",
            audience: "Food lovers, Telugu families",
            format: "Short"
        },
        {
            title: "🎭 Ancient Telugu Art Forms That Are Disappearing Forever! 😢",
            hook: "Dramatic reveal of traditional art",
            theme: "Telugu cultural heritage preservation",
            viralReason: "Urgency + cultural preservation appeal",
            musicMood: "cinematic",
            audience: "Culture enthusiasts, art lovers",
            format: "Long"
        },
        {
            title: "⛰️ 10 HIDDEN Places in Telugu States You MUST Visit! 🗺️",
            hook: "Aerial view of breathtaking landscape",
            theme: "Travel destinations in AP & Telangana",
            viralReason: "Discovery content + beautiful visuals",
            musicMood: "upbeat",
            audience: "Travel enthusiasts, locals",
            format: "Long"
        }
    ];
}
