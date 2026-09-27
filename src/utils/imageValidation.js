/**
 * Utility for validating product image URLs and detecting Google Search / redirect links
 */

/**
 * Checks if a URL is a Google Images redirect, thumbnail, search page, or unusable hotlink
 * @param {string} url
 * @returns {boolean} True if the URL is unusable as a direct product image
 */
export function isUnusableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();

  const googlePatterns = [
    'google.com/imgres',
    'google.com/url?',
    'google.co.in/imgres',
    'google.co.in/url?',
    'images.app.goo.gl',
    'encrypted-tbn0.gstatic.com',
    'encrypted-tbn1.gstatic.com',
    'encrypted-tbn2.gstatic.com',
    'encrypted-tbn3.gstatic.com',
    'encrypted-tbn',
    'tbn:and9gc',
    'lookaside.fbsbx.com',
  ];

  if (googlePatterns.some((pattern) => trimmed.includes(pattern))) {
    return true;
  }

  // Google Search query links or Googleusercontent without direct file extension
  if (
    trimmed.includes('googleusercontent.com') &&
    !trimmed.match(/\.(jpg|jpeg|png|webp|avif|gif)/i)
  ) {
    return true;
  }

  // Common search engine HTML page patterns
  if (trimmed.includes('bing.com/images/search') || trimmed.includes('yahoo.com/images')) {
    return true;
  }

  return false;
}

export const UNUSABLE_IMAGE_ERROR =
  'This is not a usable direct image URL. Please use a direct image link or upload an image.';

/**
 * Asynchronously verifies if a URL can be loaded and rendered as an image
 * @param {string} url
 * @returns {Promise<{ valid: boolean, error?: string, dimensions?: string }>}
 */
export function validateImageUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return resolve({ valid: false, error: 'Please provide an image URL or upload an image.' });
    }

    const cleanUrl = url.trim();

    // Check for Google search / redirect links immediately
    if (isUnusableImageUrl(cleanUrl)) {
      return resolve({
        valid: false,
        error: UNUSABLE_IMAGE_ERROR,
      });
    }

    // Local / uploaded paths are considered valid
    if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('data:image/') || cleanUrl.startsWith('blob:')) {
      return resolve({
        valid: true,
        dimensions: 'Local Upload',
      });
    }

    // Test real network image rendering
    const img = new Image();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve({
          valid: false,
          error: UNUSABLE_IMAGE_ERROR,
        });
      }
    }, 8000); // 8 second timeout

    img.onload = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({
          valid: true,
          dimensions: `${img.naturalWidth} × ${img.naturalHeight} px`,
        });
      } else {
        resolve({
          valid: false,
          error: UNUSABLE_IMAGE_ERROR,
        });
      }
    };

    img.onerror = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      resolve({
        valid: false,
        error: UNUSABLE_IMAGE_ERROR,
      });
    };

    img.src = cleanUrl;
  });
}

