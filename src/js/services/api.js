/* ═══════════════════════════════════════════════════════
   API SERVICE — Communication with Netlify Functions
   ═══════════════════════════════════════════════════════ */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}/${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

/**
 * Fetch the news feed — array of article cards
 */
export async function fetchFeed() {
  return apiFetch('feed');
}

/**
 * Fetch a full article by slug/topic
 */
export async function fetchArticle(slug) {
  return apiFetch('article', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  });
}

/**
 * Fetch the daily digest
 */
export async function fetchDigest() {
  return apiFetch('digest');
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
