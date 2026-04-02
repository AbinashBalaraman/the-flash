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
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
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
  if (forceRefresh) endpoint += `&t=${Date.now()}`;
  return apiFetch(endpoint);
}

/**
 * Fetch a full article by slug/topic
 */
export async function fetchArticle(slug, forceRefresh = false) {
  let endpoint = 'article';
  if (forceRefresh) endpoint += `?t=${Date.now()}`;
  return apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ slug }),
  });
}

/**
 * Fetch the daily digest
 */
export async function fetchDigest(forceRefresh = false) {
  let endpoint = 'digest';
  if (forceRefresh) endpoint += `?t=${Date.now()}`;
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
