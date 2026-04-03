/* ═══════════════════════════════════════════════════════
   API SERVICE — Communication with Netlify Functions
   ═══════════════════════════════════════════════════════ */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}/${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const msg = errorData?.details || errorData?.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(msg);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`API Error [${endpoint}]:`, err);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The AI is taking longer than expected. Please try again.');
    }
    throw err;
  }
}

/**
 * Fetch the news feed — array of article cards
 */
export async function fetchFeed(forceRefresh = false, page = 1) {
  let endpoint = `feed?page=${page}`;
  if (forceRefresh) endpoint += `&forceRefresh=true&t=${Date.now()}`;
  else endpoint += `&t=${Date.now()}`; // Always prevent browser caching
  return apiFetch(endpoint);
}

/**
 * Fetch a full article by slug/topic
 */
export async function fetchArticle(slug, forceRefresh = false) {
  return apiFetch('article', {
    method: 'POST',
    body: JSON.stringify({ slug, forceRefresh }),
  });
}

/**
 * Fetch the daily digest
 */
export async function fetchDigest(forceRefresh = false) {
  let endpoint = 'digest';
  if (forceRefresh) endpoint += `?forceRefresh=true&t=${Date.now()}`;
  else endpoint += `?t=${Date.now()}`; // Prevent browser caching
  return apiFetch(endpoint);
}

/**
 * Ask a question about a specific article
 */
export async function askQuestion(articleContext, question) {
  return apiFetch('ask', {
    method: 'POST',
    body: JSON.stringify({ context: articleContext, question }),
  });
}

/**
 * Send a chat message
 */
export async function sendChatMessage(message, history = []) {
  return apiFetch('chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
}

/**
 * Fetch generation logs for a specific slug
 */
export async function fetchLogs(slug) {
  return apiFetch(`logs?slug=${encodeURIComponent(slug)}&t=${Date.now()}`);
}
