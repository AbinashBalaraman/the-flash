/* ═══════════════════════════════════════════════════════
   APP.JS — Main application entry point
   DailyAI — Autonomous Investigative Newsroom
   ═══════════════════════════════════════════════════════ */

let aiPollCounts = { feed: 0, article: 0, digest: 0 };
let logPollingInterval = null;

// Import fetchLogs from api.js if not already there (it was added in the previous step)
import { fetchFeed, fetchArticle, fetchDigest, askQuestion, sendChatMessage, fetchLogs } from './services/api.js';
import { getState, setState, setLoading } from './services/state.js';

// ──────────────────────────────────────────────────────
// ROUTER
// ──────────────────────────────────────────────────────
function navigate(hash) {
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.nav-link');

  let target = 'feed';
  let slug = null;

  if (hash.startsWith('#/article/')) {
    target = 'article';
    slug = decodeURIComponent(hash.replace('#/article/', ''));
  } else if (hash === '#/digest') {
    target = 'digest';
  } else if (hash === '#/about') {
    target = 'about';
  }

  // Update pages
  pages.forEach(p => p.classList.remove('active'));
  const activePage = document.getElementById(`page-${target}`);
  if (activePage) activePage.classList.add('active');

  // Update nav
  navLinks.forEach(l => l.classList.remove('active'));
  const activeNav = document.querySelector(`[data-page="${target}"]`);
  if (activeNav) activeNav.classList.add('active');

  setState({ currentPage: target });

  // Load content
  if (target === 'feed' && getState().articles.length === 0) {
    loadFeed();
  }
  if (target === 'article' && slug) {
    loadArticle(slug);
  }
  if (target === 'digest' && !getState().digest) {
    loadDigest();
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

// ──────────────────────────────────────────────────────
// FEED
// ──────────────────────────────────────────────────────
let feedPage = 1;

async function loadFeed(bypassCache = false, isPolling = false) {
  feedPage = 1;

  const grid = document.getElementById('article-grid');
  const loadMoreContainer = document.getElementById('load-more-container');
  if (loadMoreContainer) loadMoreContainer.style.display = 'none';

  if (!isPolling) {
      setLoading('feed', true);
      // Inject skeleton loaders only on initial load
      grid.innerHTML = Array(6).fill(`
        <div class="article-card skeleton-card">
          <div class="skeleton skeleton-text short" style="margin-bottom: 1rem;"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text medium"></div>
        </div>
      `).join('');
  }

  try {
    const data = await fetchFeed(bypassCache, 1);
    if (data.error) throw new Error(data.message || "Unknown error occurred during background feed generation.");
    
    const validArticles = Array.isArray(data.articles) ? data.articles : [];
    setState({ articles: validArticles });
    renderFeed(validArticles);
    renderTrending(data.trending);
    
    if (validArticles.length > 0 && loadMoreContainer) {
      loadMoreContainer.style.display = 'block';
    }

    if (data.isGenerating) {
      aiPollCounts.feed++;
      const tags = document.querySelectorAll('#page-feed .dynamic-ai-tag i');
      tags.forEach(tag => {
        if (aiPollCounts.feed === 1) tag.innerText = "Extracting contextual intelligence...";
        else if (aiPollCounts.feed === 2) tag.innerText = "Synthesizing cross-market variables...";
        else if (aiPollCounts.feed >= 3) tag.innerText = "Finalizing editorial formatting...";
      });

      setTimeout(() => {
        if (getState().currentPage === 'feed') {
          loadFeed(false, true); // bypassCache=false, isPolling=true
        }
      }, 5000);
    } else {
      aiPollCounts.feed = 0;
    }
  } catch (err) {
    if (!isPolling) {
        renderFeedError(err.message);
    } else {
        console.error("Feed polling error:", err);
        const tags = document.querySelectorAll('#page-feed .dynamic-ai-tag i');
        tags.forEach(tag => {
            tag.innerHTML = `<span style="color: var(--danger);">⚠️ ${escapeHtml(err.message)}</span>`;
        });
    }
  } finally {
    if (!isPolling) setLoading('feed', false);
  }
}

window.loadMoreFeed = async function() {
  const btn = document.getElementById('load-more-btn');
  const grid = document.getElementById('article-grid');
  
  if (btn.disabled) return;
  
  btn.disabled = true;
  btn.textContent = 'Analyzing more sources...';
  
  // Append temporary skeletons
  const skeletonHTML = Array(4).fill(`
    <div class="article-card skeleton-card load-more-skeleton">
      <div class="skeleton skeleton-text short" style="margin-bottom: 1rem;"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
  `).join('');
  grid.insertAdjacentHTML('beforeend', skeletonHTML);

  feedPage++;

  try {
    const data = await fetchFeed(false, feedPage);
    if (data.error) throw new Error(data.message);
    const validArticles = Array.isArray(data.articles) ? data.articles : [];
    
    // Remove skeletons
    document.querySelectorAll('.load-more-skeleton').forEach(el => el.remove());
    
    if (validArticles.length === 0) {
      btn.textContent = 'No more intelligence available';
      return;
    }
    
    const currentArticles = getState().articles || [];
    setState({ articles: [...currentArticles, ...validArticles] });
    
    // Append new cards
    const newCardsHTML = generateFeedHTML(validArticles);
    grid.insertAdjacentHTML('beforeend', newCardsHTML);
    
    btn.textContent = 'Load More Intelligence \u2193';
    btn.disabled = false;
  } catch (err) {
    document.querySelectorAll('.load-more-skeleton').forEach(el => el.remove());
    btn.textContent = 'Failed. Try Again \u2193';
    btn.disabled = false;
  }
};

function generateFeedHTML(articles) {
  return articles.map((article, i) => `
    <div class="article-card fade-in" onclick="window.location.hash='#/article/${encodeURIComponent(article.slug)}'" role="article" tabindex="0">
      <div class="article-card__topic">
        <span class="badge badge--topic">${escapeHtml(article.topic)}</span>
      </div>
      <h2 class="article-card__title">${escapeHtml(article.title)}</h2>
      <p class="article-card__excerpt">${article.excerpt}</p>
      <div class="article-card__footer">
        <div class="article-card__meta">
          <span>${escapeHtml(article.date)}</span>
          <span class="article-card__reading-time">${article.readingTime} min read</span>
        </div>
        <span class="article-card__ai-badge">◆ AI</span>
      </div>
    </div>
  `).join('');
}

function renderFeed(articles) {
  const grid = document.getElementById('article-grid');
  const skeleton = document.getElementById('feed-skeleton');
  if (skeleton) skeleton.remove();

  grid.innerHTML = generateFeedHTML(articles);
}

function renderTrending(trends) {
  const list = document.getElementById('trending-list');
  if (!trends || !list) return;

  list.innerHTML = trends.map((t, i) => `
    <div class="trending-item" onclick="window.location.hash='#/article/${encodeURIComponent(t.slug)}'">
      <span class="trending-item__rank">${String(i + 1).padStart(2, '0')}</span>
      <span class="trending-item__name">${escapeHtml(t.name)}</span>
      <span class="trending-item__velocity">↑${t.velocity}</span>
    </div>
  `).join('');
}

function renderFeedError(message) {
  const grid = document.getElementById('article-grid');
  const skeleton = document.getElementById('feed-skeleton');
  if (skeleton) skeleton.remove();

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
      <p style="font-size: var(--text-lg); margin-bottom: 1rem;">Unable to load the feed</p>
      <p style="font-size: var(--text-sm); margin-bottom: 2rem;">${escapeHtml(message)}</p>
      <button onclick="loadFeed()" style="padding: 0.5rem 1.5rem; background: var(--accent); color: white; border-radius: var(--radius-full); font-weight: 600; cursor: pointer; border: none;">Retry</button>
    </div>
  `;
}

// ──────────────────────────────────────────────────────
// ARTICLE
// ──────────────────────────────────────────────────────
async function loadArticle(slug, bypassCache = false, isPolling = false) {
  const content = document.getElementById('article-content');
  
  if (!isPolling) {
    setLoading('article', true);
    content.innerHTML = `
      <div style="padding: 2rem 0;">
        <div class="skeleton skeleton-text short" style="height: 24px; margin-bottom: 1rem;"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text medium" style="height: 18px; margin-bottom: 2rem;"></div>
        
        <!-- Modern Status Loader -->
         <div class="article-status-banner">
           <div class="pulse-dot"></div>
           <span>DailyAI is currently compiling an investigative report on this subject...</span>
         </div>

        <div class="skeleton skeleton-text" style="height: 16px;"></div>
        <div class="skeleton skeleton-text" style="height: 16px;"></div>
        <div class="skeleton skeleton-text" style="height: 16px;"></div>
        <div class="skeleton skeleton-text" style="height: 16px;"></div>
        <div class="skeleton skeleton-text medium" style="height: 16px; margin-bottom: 2rem;"></div>
      </div>
    `;

    // Reset Q&A
    const qaMessages = document.getElementById('qa-messages');
    qaMessages.innerHTML = `
      <div class="qa-placeholder">
        <p>Ask any follow-up question about this article. The AI will answer based on the story's context.</p>
      </div>
    `;
    setState({ qaHistory: [] });
  }

  try {
    const data = await fetchArticle(slug, bypassCache);
    if (data.error) throw new Error(data.message || "Unknown error occurred during background article generation.");
    
    setState({ currentArticle: data });
    renderArticle(data);

    if (data.isGenerating) {
      aiPollCounts.article++;
      
      // Silently poll for updates in background
      // startLogPolling(slug); // Removed for modern UI

      setTimeout(() => {
        if (getState().currentPage === 'article' && window.location.hash.includes(slug)) {
          loadArticle(slug, false, true); 
        }
      }, 5000);
    } else {
      aiPollCounts.article = 0;
      stopLogPolling();
    }
  } catch (err) {
    if (!isPolling) {
        content.innerHTML = `
          <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted); border: 2px dashed rgba(255,0,0,0.2); border-radius: var(--radius-lg);">
            <p style="font-size: var(--text-lg); margin-bottom: 1rem; color: var(--danger); font-weight: 700;">Critical AI Generation Failure</p>
            <p style="font-size: var(--text-sm); color: var(--text-main); white-space: pre-wrap; text-align: left; background: rgba(0,0,0,0.3); border: 1px solid var(--danger); padding: 1.5rem; font-family: monospace; border-radius: var(--radius-sm);">${escapeHtml(err.message)}</p>
            
            <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
                <button onclick="window.location.reload()" style="padding: 0.5rem 1.5rem; background: var(--accent); color: white; border-radius: var(--radius-full); font-weight: 600; cursor: pointer; border: none;">Force Restart</button>
                <a href="#/" style="display: inline-block; padding: 0.5rem 1.5rem; color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-full);">← Back to Feed</a>
            </div>
          </div>
        `;
    } else {
        const logBody = document.getElementById('agent-logs-body');
        if (logBody) {
            logBody.innerHTML += `<div class="log-line log-line--error"><span class="log-line__marker">❌</span> FATAL: ${escapeHtml(err.message)}</div>`;
            logBody.scrollTop = logBody.scrollHeight;
        }
    }
  } finally {
    if (!isPolling) setLoading('article', false);
  }
}

// ── LOG POLLING HELPERS ──
async function startLogPolling(slug) {
  if (logPollingInterval) clearInterval(logPollingInterval);
  fetchAndRenderLogs(slug);
  logPollingInterval = setInterval(() => fetchAndRenderLogs(slug), 1500);
}

function stopLogPolling() {
  if (logPollingInterval) {
    clearInterval(logPollingInterval);
    logPollingInterval = null;
  }
}

async function fetchAndRenderLogs(slug) {
  try {
    const data = await fetchLogs(slug);
    if (data.logs && data.logs.length > 0) {
      const container = document.getElementById('agent-logs-body');
      if (container) {
        container.innerHTML = data.logs.map(log => {
          const isError = log.includes('❌') || log.includes('⚠️');
          return `<div class="log-line ${isError ? 'log-line--error' : ''}">
            <span class="log-line__marker">›</span> ${escapeHtml(log)}
          </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
      }
    }
  } catch (e) {
    console.warn('Log polling error:', e.message);
  }
}

function renderArticle(article) {
  // If we just finished generating, stop logs
  if (!article.isGenerating) {
    stopLogPolling();
  }
  const content = document.getElementById('article-content');
  
  let html = `
    <div class="article-headline">${escapeHtml(article.title)}</div>
    <div class="article-deck">${escapeHtml(article.deck)}</div>
    <div class="article-info">
      <span class="badge badge--topic">${escapeHtml(article.topic)}</span>
      <span class="article-info-divider"></span>
      <span>${escapeHtml(article.date)}</span>
      <span class="article-info-divider"></span>
      <span>${article.readingTime} min read</span>
      <span class="article-info-divider"></span>
      <span class="badge badge--ai">◆ AI-Generated</span>
    </div>
  `;

  if (article.isGenerating) {
    html += `
      <div class="article-status-banner">
        <div class="pulse-dot"></div>
        <span>DailyAI's autonomous pipeline is currently synthesizing investigative coverage for this story. Your full feature will load automatically.</span>
      </div>
    `;
  }

  html += `<div class="article-text">${article.body}</div>`;
  content.innerHTML = html;
}

// ──────────────────────────────────────────────────────
// DIGEST
// ──────────────────────────────────────────────────────
async function loadDigest(bypassCache = false, isPolling = false) {
  if (!isPolling) setLoading('digest', true);
  try {
    const data = await fetchDigest(bypassCache);
    if (data.error) throw new Error(data.message || "Unknown error occurred during background digest generation.");
    
    setState({ digest: data });
    renderDigest(data);

    if (data.isGenerating) {
      aiPollCounts.digest++;
      const tag = document.querySelector('#page-digest .dynamic-ai-tag i');
      if (tag) {
         if (aiPollCounts.digest === 1) tag.innerText = "Correlating massive data vectors...";
         else if (aiPollCounts.digest === 2) tag.innerText = "Generating executive briefing...";
         else if (aiPollCounts.digest >= 3) tag.innerText = "Refining 60-second summary...";
      }
      setTimeout(() => {
        if (getState().currentPage === 'digest') {
          loadDigest(false, true); // bypassCache=false, isPolling=true
        }
      }, 5000);
    } else {
      aiPollCounts.digest = 0;
    }
  } catch (err) {
    const stories = document.getElementById('digest-stories');
    const skeleton = document.getElementById('digest-skeleton');
    if (skeleton) skeleton.remove();
    stories.innerHTML = `
      <div style="text-align: center; padding: 4rem; color: var(--text-muted);">
        <p>Unable to generate today's digest</p>
        <p style="font-size: var(--text-sm); margin-top: 0.5rem; color: var(--danger); white-space: pre-wrap; text-align: left; background: rgba(255,0,0,0.1); padding: 1rem;">${escapeHtml(err.message)}</p>
      </div>
    `;
  } finally {
    if (!isPolling) setLoading('digest', false);
  }
}

function renderDigest(data) {
  const dateEl = document.getElementById('digest-date');
  const stories = document.getElementById('digest-stories');
  const skeleton = document.getElementById('digest-skeleton');
  if (skeleton) skeleton.remove();

  dateEl.textContent = data.date;
  stories.innerHTML = data.stories.map((story, i) => `
    <div class="digest-story" onclick="window.location.hash='#/article/${encodeURIComponent(story.slug)}'">
      <div class="digest-story__number">Story ${i + 1} of ${data.stories.length}</div>
      <h3 class="digest-story__title">${escapeHtml(story.title)}</h3>
      <p class="digest-story__summary">${story.summary}</p>
    </div>
  `).join('');
}

// ──────────────────────────────────────────────────────
// Q&A PANEL
// ──────────────────────────────────────────────────────
function initQA() {
  const form = document.getElementById('qa-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('qa-input');
    const question = input.value.trim();
    if (!question) return;

    const article = getState().currentArticle;
    if (!article) return;

    input.value = '';
    const qaMessages = document.getElementById('qa-messages');

    // Remove placeholder
    const placeholder = qaMessages.querySelector('.qa-placeholder');
    if (placeholder) placeholder.remove();

    // Add user question
    qaMessages.insertAdjacentHTML('beforeend', `<div class="qa-message qa-message--user">❯ ${escapeHtml(question)}</div>`);

    // Add loading
    const loadingId = `qa-loading-${Date.now()}`;
    qaMessages.insertAdjacentHTML('beforeend', `
    <div class="qa-message qa-message--ai" id="${loadingId}">
      <div class="qa-content">
        <p class="typing-indicator" style="font-size: var(--text-sm);">Bureau is reviewing sources<span>.</span><span>.</span><span>.</span></p>
      </div>
    </div>
  `);

  qaMessages.scrollTop = qaMessages.scrollHeight;

  try {
    const data = await askQuestion(
        `Title: ${article.title}\n\n${article.body?.replace(/<[^>]*>/g, '')}`,
        question
      );
    
    const loadingEl = document.getElementById(loadingId);
    if (!data || !data.answer) {
        throw new Error("Missing answer payload from backend");
    }
    loadingEl.innerHTML = `<div class="qa-content"><p>${escapeHtml(data.answer)}</p></div>`;
  } catch (err) {
    document.getElementById(loadingId).innerHTML = `<div class="qa-content"><p style="color: var(--error);"><i>Verification desk unavailable. Error: ${err.message}.</i></p></div>`;
  }
    qaMessages.scrollTop = qaMessages.scrollHeight;
  });
}

// ──────────────────────────────────────────────────────
// CHAT LAYER
// ──────────────────────────────────────────────────────
function initChat() {
  const overlay = document.getElementById('chat-overlay');
  const toggleBtn = document.getElementById('chat-toggle');
  const closeBtn = document.getElementById('chat-close');
  const form = document.getElementById('chat-form');

  toggleBtn.addEventListener('click', () => {
    overlay.classList.toggle('open');
    if (overlay.classList.contains('open')) {
      document.getElementById('chat-input').focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const chatMessages = document.getElementById('chat-messages');

    // Add User Message
    chatMessages.insertAdjacentHTML('beforeend', `
      <div class="chat-message chat-message--user">
        <div class="chat-message__content">
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `);

    // Add initial "loading" state
    const loadingId = 'loading-' + Date.now();
    chatMessages.insertAdjacentHTML('beforeend', `
      <div class="chat-message chat-message--ai" id="${loadingId}">
        <div class="chat-message__content">
          <p class="typing-indicator">Desk is analyzing<span>.</span><span>.</span><span>.</span></p>
        </div>
      </div>
    `);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const history = getState().chatHistory;
      const data = await sendChatMessage(message, history);

      const loadingEl = document.getElementById(loadingId);
      if (!data || !data.response) {
          throw new Error("Invalid response structure from backend.");
      }
      loadingEl.innerHTML = `<div class="chat-message__content">${formatChatResponse(data.response)}</div>`;

      setState({
        chatHistory: [
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content: responseText },
        ],
      });
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      messages.innerHTML += `
        <div class="chat-message chat-message--ai">
          <div class="chat-message__content"><p style="color: var(--danger);">Sorry, something went wrong. Please try again.</p></div>
        </div>
      `;
    }
    messages.scrollTop = messages.scrollHeight;
  });
}

function formatChatResponse(text) {
  // Basic markdown-ish formatting
  return text
    .split('\n\n')
    .map(p => `<p>${p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`)
    .join('');
}

// ──────────────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Expose loadFeed globally for retry button
window.loadFeed = loadFeed;

// ──────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initialize components
  initChat();
  initQA();

  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const iconSun = themeToggle.querySelector('.icon-sun');
    const iconMoon = themeToggle.querySelector('.icon-moon');
    
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light-theme');
      iconSun.style.display = 'block';
      iconMoon.style.display = 'none';
    }
    
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      if (isLight) {
        iconSun.style.display = 'block';
        iconMoon.style.display = 'none';
      } else {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
      }
    });
  }

  const forceRefreshBtn = document.getElementById('force-refresh-btn');
  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', () => {
      const state = getState();
      if (state.currentPage === 'feed') {
        loadFeed(true, false); // bypassCache=true, isPolling=false
      } else if (state.currentPage === 'digest') {
        loadDigest(true, false);
      } else if (state.currentPage === 'article') {
        const hash = window.location.hash;
        if (hash.startsWith('#/article/')) {
          const slug = decodeURIComponent(hash.replace('#/article/', ''));
          loadArticle(slug, true, false);
        }
      }
    });
  }

  // Handle routing
  window.addEventListener('hashchange', () => navigate(window.location.hash));

  // Initial route
  navigate(window.location.hash || '#/');
});
