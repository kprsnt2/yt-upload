// Direct text-to-video generation using Hugging Face Inference API.
// Optional env: HUGGINGFACE_API_KEY (recommended to avoid strict free-tier limits)

const VIDEO_MODELS = {
    cheap: {
        id: 'cheap',
        name: 'Cheap (Fast Draft)',
        provider: 'huggingface',
        providerModel: 'cerspense/zeroscope_v2_576w',
        description: 'Fastest and lowest-cost draft video generation.',
    },
    balanced: {
        id: 'balanced',
        name: 'Balanced (Recommended)',
        provider: 'huggingface',
        providerModel: 'THUDM/CogVideoX-2b',
        description: 'Good quality and latency trade-off.',
    },
    best: {
        id: 'best',
        name: 'Best (Quality)',
        provider: 'huggingface',
        providerModel: 'genmo/mochi-1-preview',
        description: 'Highest visual quality profile (slower and costlier).',
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, model = 'balanced', format = 'short' } = req.body || {};
        if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

        const selectedModel = VIDEO_MODELS[model] || VIDEO_MODELS.balanced;
        const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN;
        const isPortrait = format === 'short';

        if (!apiKey) {
            return res.status(400).json({
                error: 'Hugging Face token is required for direct video generation. Set HUGGINGFACE_API_KEY (or HF_TOKEN).',
                model: {
                    id: selectedModel.id,
                    name: selectedModel.name,
                    provider: selectedModel.provider,
                    providerModel: selectedModel.providerModel,
                    description: selectedModel.description,
                },
            });
        }

        const enhancedPrompt = `${prompt}. High quality cinematic motion, stable camera movement, clean details, no text, no watermark.`;
        const negativePrompt = 'blurry, low quality, artifacts, watermark, text, logo, flicker, distortion';

        const response = await fetch(`https://router.huggingface.co/hf-inference/models/${selectedModel.providerModel}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                inputs: enhancedPrompt,
                parameters: {
                    negative_prompt: negativePrompt,
                    num_frames: isPortrait ? 48 : 72,
                    num_inference_steps: selectedModel.id === 'cheap' ? 20 : selectedModel.id === 'best' ? 40 : 30,
                    guidance_scale: selectedModel.id === 'cheap' ? 6 : selectedModel.id === 'best' ? 8 : 7,
                },
                options: {
                    wait_for_model: true,
                    use_cache: false,
                },
            }),
            signal: AbortSignal.timeout(180000),
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            const rawBody = await response.text();

            let providerMessage = 'Unknown error.';
            if (contentType.includes('application/json')) {
                try {
                    const parsed = JSON.parse(rawBody);
                    providerMessage = parsed?.error || parsed?.message || rawBody || providerMessage;
                } catch {
                    providerMessage = rawBody || providerMessage;
                }
            } else if (contentType.includes('text/html')) {
                providerMessage = response.status === 401 || response.status === 403
                    ? 'Unauthorized by Hugging Face. Verify token and permissions.'
                    : 'Provider returned an HTML error page.';
            } else {
                providerMessage = rawBody || providerMessage;
            }

            const authHint = (response.status === 401 || response.status === 403)
                ? ' Use HUGGINGFACE_API_KEY (or HF_TOKEN) with Inference permissions.'
                : '';

            return res.status(response.status).json({
                error: `Video provider error (${response.status}). ${providerMessage}${authHint}`,
                model: {
                    id: selectedModel.id,
                    name: selectedModel.name,
                    provider: selectedModel.provider,
                    providerModel: selectedModel.providerModel,
                    description: selectedModel.description,
                },
            });
        }

        const contentType = response.headers.get('content-type') || '';

        // Some HF endpoints can return JSON status payloads while loading/erroring.
        if (contentType.includes('application/json')) {
            const json = await response.json();
            return res.status(502).json({
                error: json?.error || json?.message || 'Video model returned JSON instead of video bytes.',
                details: json,
                model: {
                    id: selectedModel.id,
                    name: selectedModel.name,
                    provider: selectedModel.provider,
                    providerModel: selectedModel.providerModel,
                    description: selectedModel.description,
                },
            });
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Video = Buffer.from(arrayBuffer).toString('base64');

        return res.json({
            success: true,
            model: {
                id: selectedModel.id,
                name: selectedModel.name,
                provider: selectedModel.provider,
                providerModel: selectedModel.providerModel,
                description: selectedModel.description,
            },
            mimeType: contentType || 'video/mp4',
            video: `data:${contentType || 'video/mp4'};base64,${base64Video}`,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to generate video' });
    }
}
