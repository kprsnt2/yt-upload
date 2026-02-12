/**
 * Browser-based video compiler using Canvas + MediaRecorder API
 * No server/FFmpeg needed - runs entirely in the browser
 */

/**
 * Compile images into a video with optional audio
 * @param {string[]} imageDataUrls - Array of image data URLs or regular URLs
 * @param {Object} options - Configuration options
 * @param {string} options.format - 'short' (9:16) or 'long' (16:9)
 * @param {number} options.durationPerImage - Seconds per image (default 4)
 * @param {string} options.audioUrl - Optional audio URL to mix in
 * @param {Function} options.onProgress - Progress callback (0-100)
 * @returns {Promise<Blob>} - Video blob (webm format)
 */
export async function compileVideoInBrowser(imageDataUrls, options = {}) {
    const {
        format = 'short',
        durationPerImage = 4,
        audioUrl = null,
        onProgress = () => { },
    } = options;

    // Resolution
    const width = format === 'short' ? 1080 : 1920;
    const height = format === 'short' ? 1920 : 1080;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Load all images first
    onProgress(5);
    const loadedImages = await Promise.all(
        imageDataUrls.map((src, i) => loadImage(src).then(img => {
            onProgress(5 + Math.round((i / imageDataUrls.length) * 20));
            return img;
        }))
    );

    onProgress(25);

    // Set up MediaRecorder
    const fps = 30;
    const stream = canvas.captureStream(fps);

    // Add audio if provided
    let audioContext, audioSource, audioDestination;
    if (audioUrl) {
        try {
            audioContext = new AudioContext();
            const audioBuffer = await loadAudio(audioContext, audioUrl);
            audioDestination = audioContext.createMediaStreamDestination();
            audioSource = audioContext.createBufferSource();
            audioSource.buffer = audioBuffer;
            audioSource.connect(audioDestination);
            audioSource.connect(audioContext.destination);

            // Merge audio stream with video stream
            const audioTrack = audioDestination.stream.getAudioTracks()[0];
            if (audioTrack) stream.addTrack(audioTrack);
        } catch (err) {
            console.warn('Audio loading failed, proceeding without audio:', err.message);
        }
    }

    // Determine supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : 'video/webm';

    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000, // 5 Mbps
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    // Start recording
    return new Promise((resolve, reject) => {
        recorder.onerror = reject;

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            // Clean up
            if (audioSource) {
                try { audioSource.stop(); } catch { }
            }
            if (audioContext) {
                try { audioContext.close(); } catch { }
            }
            onProgress(100);
            resolve(blob);
        };

        recorder.start(100); // Collect data every 100ms

        // Start audio if available
        if (audioSource) {
            audioSource.start(0);
        }

        // Animate frames
        const totalDuration = loadedImages.length * durationPerImage;
        const totalFrames = totalDuration * fps;
        let frame = 0;

        function renderFrame() {
            if (frame >= totalFrames) {
                recorder.stop();
                return;
            }

            const currentTime = frame / fps;
            const imageIndex = Math.min(
                Math.floor(currentTime / durationPerImage),
                loadedImages.length - 1
            );
            const img = loadedImages[imageIndex];

            // Time within current image (0 to 1)
            const localTime = (currentTime % durationPerImage) / durationPerImage;

            // Clear canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Draw image with Ken Burns effect (slow zoom + pan)
            drawImageWithEffect(ctx, img, width, height, localTime, imageIndex);

            // Fade transition between images
            const fadeTime = 0.15; // 15% of duration for fade
            if (localTime < fadeTime && imageIndex > 0) {
                // Fade in from previous
                const alpha = localTime / fadeTime;
                ctx.globalAlpha = 1 - alpha;
                drawImageWithEffect(ctx, loadedImages[imageIndex - 1], width, height, 1, imageIndex - 1);
                ctx.globalAlpha = 1;
            }

            // Progress
            const progress = 30 + Math.round((frame / totalFrames) * 65);
            onProgress(progress);

            frame++;
            // Use requestAnimationFrame for better performance, with frame skipping
            if (frame % 2 === 0) {
                requestAnimationFrame(renderFrame);
            } else {
                setTimeout(renderFrame, 0);
            }
        }

        renderFrame();
    });
}

/**
 * Draw image with Ken Burns effect
 */
function drawImageWithEffect(ctx, img, canvasW, canvasH, t, index) {
    // Determine zoom and pan direction based on image index
    const zoomStart = 1.0;
    const zoomEnd = 1.15;
    const zoom = zoomStart + (zoomEnd - zoomStart) * t;

    // Alternate pan direction
    const panX = (index % 2 === 0 ? 1 : -1) * t * 0.05;
    const panY = (index % 3 === 0 ? 1 : -1) * t * 0.03;

    // Calculate draw dimensions (cover mode)
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasW / canvasH;

    let drawW, drawH;
    if (imgRatio > canvasRatio) {
        drawH = canvasH * zoom;
        drawW = drawH * imgRatio;
    } else {
        drawW = canvasW * zoom;
        drawH = drawW / imgRatio;
    }

    const x = (canvasW - drawW) / 2 + panX * canvasW;
    const y = (canvasH - drawH) / 2 + panY * canvasH;

    ctx.drawImage(img, x, y, drawW, drawH);
}

/**
 * Load an image from a URL or data URL
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Load audio from URL into AudioBuffer
 */
async function loadAudio(audioContext, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob, filename = 'video.webm') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Convert webm blob to a shareable object URL
 */
export function createVideoUrl(blob) {
    return URL.createObjectURL(blob);
}
