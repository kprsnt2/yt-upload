import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, '..', 'output');
const tempDir = path.join(__dirname, '..', 'temp');

/**
 * Compile images into a video with optional music
 * Supports Shorts (9:16) and Long (16:9) formats
 */
export async function compileVideo(images, musicUrl, format = 'short', durationPerImage = 4, title = 'video') {
    const videoId = uuidv4();
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const outputFile = path.join(outputDir, `${safeTitle}_${videoId}.mp4`);

    // Download images to local temp if they are URLs
    const localImages = await downloadImages(images);
    if (localImages.length === 0) throw new Error('No valid images to compile');

    // Determine resolution based on format
    const resolution = format === 'short' ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };

    // Download music if URL provided
    let localMusicPath = null;
    if (musicUrl) {
        localMusicPath = await downloadMusic(musicUrl);
    }

    // Create video with FFmpeg
    return new Promise((resolve, reject) => {
        // Create a text file listing images and their durations for FFmpeg concat
        const concatFile = path.join(tempDir, `concat_${videoId}.txt`);
        const concatContent = localImages
            .map(img => `file '${img.replace(/\\/g, '/')}'\nduration ${durationPerImage}`)
            .join('\n');
        // Add last image again (FFmpeg concat demuxer quirk)
        const fullContent = concatContent + `\nfile '${localImages[localImages.length - 1].replace(/\\/g, '/')}'`;
        fs.writeFileSync(concatFile, fullContent);

        let command = ffmpeg()
            .input(concatFile)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .videoCodec('libx264')
            .outputOptions([
                `-vf`, `scale=${resolution.w}:${resolution.h}:force_original_aspect_ratio=decrease,pad=${resolution.w}:${resolution.h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
                '-pix_fmt', 'yuv420p',
                '-r', '30',
                '-preset', 'medium',
                '-crf', '23'
            ]);

        // Add music if provided
        if (localMusicPath) {
            command = command
                .input(localMusicPath)
                .audioCodec('aac')
                .audioBitrate('192k')
                .outputOptions(['-shortest']);
        }

        command
            .output(outputFile)
            .on('start', (cmd) => console.log('FFmpeg command:', cmd))
            .on('progress', (progress) => {
                if (progress.percent) console.log(`Compiling: ${Math.round(progress.percent)}%`);
            })
            .on('end', () => {
                // Clean up temp concat file
                try { fs.unlinkSync(concatFile); } catch { }
                console.log('Video compiled successfully:', outputFile);
                resolve(`/output/${path.basename(outputFile)}`);
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                // Clean up
                try { fs.unlinkSync(concatFile); } catch { }
                reject(new Error(`Video compilation failed: ${err.message}`));
            })
            .run();
    });
}

async function downloadImages(images) {
    const localPaths = [];

    for (const img of images) {
        try {
            let localPath;

            if (typeof img === 'string') {
                if (img.startsWith('/temp/') || img.startsWith('/output/')) {
                    // Local server path
                    localPath = path.join(__dirname, '..', img);
                } else if (img.startsWith('http')) {
                    // Remote URL - download
                    localPath = await downloadFile(img, `img_${uuidv4()}.png`);
                } else if (img.startsWith('data:image')) {
                    // Base64 data URL
                    const base64Data = img.split(',')[1];
                    localPath = path.join(tempDir, `img_${uuidv4()}.png`);
                    fs.writeFileSync(localPath, Buffer.from(base64Data, 'base64'));
                }
            } else if (img.url) {
                if (img.url.startsWith('/')) {
                    localPath = path.join(__dirname, '..', img.url);
                } else {
                    localPath = await downloadFile(img.url, `img_${uuidv4()}.png`);
                }
            }

            if (localPath && fs.existsSync(localPath)) {
                localPaths.push(localPath);
            }
        } catch (err) {
            console.warn('Failed to download image:', err.message);
        }
    }

    return localPaths;
}

async function downloadMusic(musicUrl) {
    if (musicUrl.startsWith('/uploads/') || musicUrl.startsWith('/temp/')) {
        const localPath = path.join(__dirname, '..', musicUrl);
        if (fs.existsSync(localPath)) return localPath;
    }

    if (musicUrl.startsWith('http')) {
        return await downloadFile(musicUrl, `music_${uuidv4()}.mp3`);
    }

    return null;
}

async function downloadFile(url, filename) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}
