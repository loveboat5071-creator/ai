/**
 * URL Utilities for Homepage URL Normalization
 */

/**
 * Normalizes a URL to ensure it has a proper protocol
 * @param url - The URL to normalize (can be "example.com", "http://example.com", "https://example.com")
 * @returns Normalized URL with https:// protocol, or null if invalid
 *
 * Examples:
 * - "beaund.com" -> "https://beaund.com"
 * - "http://beaund.com" -> "https://beaund.com"
 * - "https://beaund.com" -> "https://beaund.com"
 * - "www.beaund.com" -> "https://www.beaund.com"
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Trim whitespace
  url = url.trim();

  // Remove any trailing punctuation that might have been captured
  url = url.replace(/[,\.\)\]]+$/, '');

  // If it's already a valid URL with protocol, upgrade http to https
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  if (url.startsWith('https://')) {
    return url;
  }

  // Check if it looks like a domain (has at least one dot and valid characters)
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

  // Remove common prefixes if they exist
  let cleanUrl = url;
  if (cleanUrl.startsWith('www.')) {
    // Keep www. but add protocol
    return `https://${cleanUrl}`;
  }

  // Check if it's a valid domain
  if (domainRegex.test(cleanUrl)) {
    return `https://${cleanUrl}`;
  }

  // If it doesn't match any pattern, return null
  return null;
}

/**
 * Validates if a URL is accessible
 * @param url - The URL to validate
 * @returns true if URL appears valid, false otherwise
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts domain from URL
 * @param url - The URL to extract domain from
 * @returns Domain name or null
 *
 * Examples:
 * - "https://beaund.com/about" -> "beaund.com"
 * - "https://www.beaund.com" -> "www.beaund.com"
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;

    const parsed = new URL(normalized);
    return parsed.hostname;
  } catch {
    return null;
  }
}
