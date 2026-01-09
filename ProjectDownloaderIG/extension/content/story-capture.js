/**
 * InstaDown - Story Video Capture Content Script
 * Captures video/image from Instagram story pages
 */

console.log('[InstaDown] Story capture script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureStory') {
        captureStoryMedia().then(sendResponse);
        return true; // Keep channel open for async response
    }
});

/**
 * Capture story media from the current page
 */
async function captureStoryMedia() {
    console.log('[InstaDown] Capturing story media...');

    const results = {
        success: false,
        media: [],
        username: extractUsername(),
        error: null
    };

    try {
        // Extract fallback thumbnail from meta tags or JSON (for when video.poster is not available)
        let fallbackThumbnail = null;

        // Method 0a: Try og:image meta tag
        const metaOg = document.querySelector('meta[property="og:image"]');
        if (metaOg && metaOg.content) {
            fallbackThumbnail = metaOg.content;
            console.log('[InstaDown] Fallback thumbnail from og:image');
        }

        // Method 0b: Try twitter:image meta tag
        if (!fallbackThumbnail) {
            const metaTwitter = document.querySelector('meta[name="twitter:image"]');
            if (metaTwitter && metaTwitter.content) {
                fallbackThumbnail = metaTwitter.content;
                console.log('[InstaDown] Fallback thumbnail from twitter:image');
            }
        }

        // Method 0c: Try to find display_url or thumbnail_src from page JSON
        if (!fallbackThumbnail) {
            const html = document.documentElement.innerHTML;
            const thumbPatterns = [
                /"thumbnail_src"\s*:\s*"(https?:[^"]+)"/,
                /"display_url"\s*:\s*"(https?:[^"]+)"/,
                /"image_versions2"[^}]*"url"\s*:\s*"(https?:[^"]+)"/
            ];
            for (const pattern of thumbPatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    fallbackThumbnail = decodeUrl(match[1]);
                    console.log('[InstaDown] Fallback thumbnail from JSON');
                    break;
                }
            }
        }

        // Method 0d: Find any large image on the page (Story content images)
        if (!fallbackThumbnail) {
            const allImages = document.querySelectorAll('img[src*="cdninstagram"], img[src*="fbcdn"]');
            for (const img of allImages) {
                const src = img.src;
                // Filter: must be large (not profile pic, not tiny icon)
                // Check for story content image patterns
                if (src &&
                    !src.includes('150x150') &&
                    !src.includes('44x44') &&
                    !src.includes('profile') &&
                    !src.includes('s320x320') &&
                    (img.width > 200 || img.naturalWidth > 200 || src.includes('1080'))) {
                    fallbackThumbnail = src;
                    console.log('[InstaDown] Fallback thumbnail from large image on page:', src.substring(0, 80));
                    break;
                }
            }
        }

        // Final fallback log
        console.log('[InstaDown] Fallback thumbnail resolved to:', fallbackThumbnail);

        // Method 1: Find video elements
        const videos = document.querySelectorAll('video');
        console.log('[InstaDown] Found', videos.length, 'video elements');

        for (const video of videos) {
            const src = video.src || video.currentSrc;
            const poster = video.poster; // Extract poster/thumbnail

            if (src && src.startsWith('http')) {
                // Direct URL (not blob)
                results.media.push({
                    type: 'video',
                    url: src,
                    thumbnail: poster || fallbackThumbnail, // Include thumbnail
                    isBlob: false
                });
                console.log('[InstaDown] Video URL:', src.substring(0, 100));
            } else if (src && src.startsWith('blob:')) {
                // Blob URL - need to convert
                console.log('[InstaDown] Blob video detected, attempting conversion...');
                try {
                    const dataUrl = await blobToDataUrl(src);
                    if (dataUrl) {
                        results.media.push({
                            type: 'video',
                            url: dataUrl,
                            thumbnail: poster || fallbackThumbnail, // Include thumbnail
                            isBlob: true,
                            originalBlob: src
                        });
                        console.log('[InstaDown] Blob converted successfully');
                    }
                } catch (e) {
                    console.error('[InstaDown] Blob conversion failed:', e);
                }
            }

            // Also check source elements
            const sources = video.querySelectorAll('source');
            for (const source of sources) {
                if (source.src && source.src.startsWith('http')) {
                    results.media.push({
                        type: 'video',
                        url: source.src,
                        thumbnail: poster || fallbackThumbnail, // Use parent video poster
                        isBlob: false
                    });
                }
            }
        }

        // Method 2: Find images (for image stories)
        const images = document.querySelectorAll('img[src*="cdninstagram"], img[src*="fbcdn"]');
        console.log('[InstaDown] Found', images.length, 'potential story images');

        for (const img of images) {
            const src = img.src;
            // Filter out profile pics and thumbnails
            if (src &&
                !src.includes('150x150') &&
                !src.includes('profile') &&
                !src.includes('44x44') &&
                (img.width > 200 || img.naturalWidth > 200)) {
                results.media.push({
                    type: 'image',
                    url: src,
                    isBlob: false
                });
                console.log('[InstaDown] Image URL:', src.substring(0, 100));
            }
        }

        // Method 3: Extract from page scripts/JSON
        const scriptMedia = extractFromScripts();
        for (const m of scriptMedia) {
            if (!results.media.some(existing => existing.url === m.url)) {
                results.media.push(m);
            }
        }

        // Deduplicate
        const seen = new Set();
        results.media = results.media.filter(m => {
            if (seen.has(m.url)) return false;
            seen.add(m.url);
            return true;
        });

        // Post-processing: Use first image URL as thumbnail for videos without thumbnail
        const firstImageUrl = results.media.find(m => m.type === 'image')?.url;
        if (firstImageUrl) {
            let usedAsThumbnail = false;
            results.media.forEach(m => {
                if (m.type === 'video' && !m.thumbnail) {
                    m.thumbnail = firstImageUrl;
                    usedAsThumbnail = true;
                    console.log('[InstaDown] Assigned image URL as video thumbnail');
                }
            });

            // Remove the image from list if it was used as a video thumbnail
            if (usedAsThumbnail) {
                results.media = results.media.filter(m => m.url !== firstImageUrl);
            }
        }

        results.success = results.media.length > 0;
        results.count = results.media.length;

        if (!results.success) {
            results.error = 'No media found on this page';
        }

        console.log('[InstaDown] Capture result:', results.media.length, 'items');

    } catch (error) {
        results.error = error.message;
        console.error('[InstaDown] Capture error:', error);
    }

    return results;
}

/**
 * Extract username from page or URL
 */
function extractUsername() {
    const pathname = window.location.pathname;

    // For highlights, we need to get username from page, not URL
    const isHighlight = pathname.includes('/stories/highlights/');

    // Method 1: From visible username link/span on page
    const usernameSelectors = [
        'header a[href^="/"]',
        'a[role="link"][href^="/"]',
        'span[dir="auto"]'
    ];

    for (const selector of usernameSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            // Check href attribute for links
            if (el.href) {
                const href = new URL(el.href).pathname;
                const match = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                if (match && match[1] && match[1].length > 1 &&
                    !['explore', 'reels', 'stories', 'highlights', 'direct'].includes(match[1])) {
                    console.log('[InstaDown] Username from link:', match[1]);
                    return match[1];
                }
            }
            // Check text content
            const text = el.textContent?.trim();
            if (text && text.match(/^[a-zA-Z0-9_.]+$/) && text.length > 1 && text.length < 30 &&
                !['Follow', 'Following', 'Message', 'Reply'].includes(text)) {
                // Verify it looks like a username (no spaces, reasonable length)
                console.log('[InstaDown] Username from text:', text);
                return text;
            }
        }
    }

    // Method 2: From JSON in page
    const html = document.documentElement.innerHTML;
    const ownerPatterns = [
        /"owner"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/,
        /"user"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of ownerPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            console.log('[InstaDown] Username from JSON:', match[1]);
            return match[1];
        }
    }

    // Method 3: From "Reply to username" placeholder
    const replyInput = document.querySelector('input[placeholder*="Reply to"]');
    if (replyInput) {
        const placeholder = replyInput.placeholder;
        const match = placeholder.match(/Reply to ([a-zA-Z0-9_.]+)/);
        if (match && match[1]) {
            console.log('[InstaDown] Username from reply placeholder:', match[1]);
            return match[1];
        }
    }

    // Method 4: Fallback to URL for regular stories
    if (!isHighlight) {
        const match = pathname.match(/\/stories\/([^\/]+)/);
        if (match && match[1] && match[1] !== 'highlights') {
            return match[1];
        }
    }

    return 'unknown';
}

/**
 * Convert blob URL to data URL
 */
async function blobToDataUrl(blobUrl) {
    try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[InstaDown] blobToDataUrl error:', error);
        return null;
    }
}

/**
 * Extract media URLs from page scripts
 */
function extractFromScripts() {
    const results = [];
    const html = document.documentElement.innerHTML;

    // Video URL patterns
    const videoPatterns = [
        /"video_url"\s*:\s*"(https?:[^"]+)"/g,
        /"playback_url"\s*:\s*"(https?:[^"]+)"/g,
        /"video_versions"[^}]*"url"\s*:\s*"(https?:[^"]+)"/g
    ];

    for (const pattern of videoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            if (match[1]) {
                const url = decodeUrl(match[1]);
                results.push({ type: 'video', url, isBlob: false });
            }
        }
    }

    // Image URL patterns
    const imagePatterns = [
        /"display_url"\s*:\s*"(https?:[^"]+)"/g,
        /"image_versions2"[^}]*"url"\s*:\s*"(https?:[^"]+)"/g
    ];

    for (const pattern of imagePatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            if (match[1]) {
                const url = decodeUrl(match[1]);
                if (!url.includes('150x150') && !url.includes('profile')) {
                    results.push({ type: 'image', url, isBlob: false });
                }
            }
        }
    }

    return results;
}

/**
 * Decode escaped URL
 */
function decodeUrl(url) {
    return url
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/')
        .replace(/\\/g, '');
}

// Auto-detect media when page loads
setTimeout(() => {
    captureStoryMedia().then(result => {
        console.log('[InstaDown] Auto-detection result:', result);
    });
}, 2000);
