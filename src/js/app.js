/* ═══════════════════════════════════════════════════════
   APP.JS — Main application entry point
   THE SIGNAL — AI-Native Newsroom
   ═══════════════════════════════════════════════════════ */

import { fetchFeed, fetchArticle, fetchDigest, askQuestion, sendChatMessage } from './services/api.js';
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

async function loadFeed(force = false) {
  feedPage = 1;
  setLoading('feed', true);
  
  const grid = document.getElementById('article-grid');
  document.getElementById('load-more-container').style.display = 'none';

  // Inject skeleton loaders
  grid.innerHTML = Array(6).fill(`
    <div class="article-card skeleton-card">
      <div class="skeleton skeleton-text short" style="margin-bottom: 1rem;"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text medium"></div>
    </div>
  `).join('');

  try {
    const data = await fetchFeed(force, 1);
    const validArticles = Array.isArray(data.articles) ? data.articles : [];
    setState({ articles: validArticles });
    renderFeed(validArticles);
    renderTrending(data.trending);
    
    if (validArticles.length > 0) {
      document.getElementById('load-more-container').style.display = 'block';
    }
  } catch (err) {
    renderFeedError(err.message);
  } finally {
    setLoading('feed', false);
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
      <p class="article-card__excerpt">${escapeHtml(article.excerpt)}</p>
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
async function loadArticle(slug) {
  setLoading('article', true);
  const content = document.getElementById('article-content');
  content.innerHTML = `
    <div style="padding: 2rem 0;">
      <div class="skeleton skeleton-text short" style="height: 24px; margin-bottom: 1rem;"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text medium" style="height: 18px; margin-bottom: 3rem;"></div>
      
      <div class="skeleton skeleton-text" style="height: 16px;"></div>
      <div class="skeleton skeleton-text" style="height: 16px;"></div>
      <div class="skeleton skeleton-text" style="height: 16px;"></div>
      <div class="skeleton skeleton-text" style="height: 16px;"></div>
      <div class="skeleton skeleton-text medium" style="height: 16px; margin-bottom: 2rem;"></div>
      
      <div class="skeleton skeleton-title" style="height: 1.5em; width: 40%;"></div>
      <div class="skeleton skeleton-text" style="height: 16px;"></div>
      <div class="skeleton skeleton-text" style="height: 16px;"></div>
      <div class="skeleton skeleton-text medium" style="height: 16px;"></div>
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

  try {
    const data = await fetchArticle(slug);
    setState({ currentArticle: data });
    renderArticle(data);
  } catch (err) {
    content.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
        <p style="font-size: var(--text-lg); margin-bottom: 1rem;">Couldn't load article</p>
        <p style="font-size: var(--text-sm);">${escapeHtml(err.message)}</p>
        <a href="#/" style="display: inline-block; margin-top: 2rem; color: var(--accent);">← Back to Feed</a>
      </div>
    `;
  } finally {
    setLoading('article', false);
  }
}

function renderArticle(article) {
  const content = document.getElementById('article-content');
  content.innerHTML = `
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
    <div class="article-text">${article.body}</div>
  `;
}

// ──────────────────────────────────────────────────────
// DIGEST
// ──────────────────────────────────────────────────────
async function loadDigest() {
  setLoading('digest', true);
  try {
    const data = await fetchDigest();
    setState({ digest: data });
    renderDigest(data);
  } catch (err) {
    const stories = document.getElementById('digest-stories');
    const skeleton = document.getElementById('digest-skeleton');
    if (skeleton) skeleton.remove();
    stories.innerHTML = `
      <div style="text-align: center; padding: 4rem; color: var(--text-muted);">
        <p>Unable to generate today's digest</p>
        <p style="font-size: var(--text-sm); margin-top: 0.5rem;">${escapeHtml(err.message)}</p>
      </div>
    `;
  } finally {
    setLoading('digest', false);
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
      <p class="digest-story__summary">${escapeHtml(story.summary)}</p>
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
    const messages = document.getElementById('qa-messages');

    // Remove placeholder
    const placeholder = messages.querySelector('.qa-placeholder');
    if (placeholder) placeholder.remove();

    // Add user question
    messages.innerHTML += `<div class="qa-message qa-message--user">❯ ${escapeHtml(question)}</div>`;

    // Add loading
    const loadingId = `qa-loading-${Date.now()}`;
    messages.innerHTML += `
      <div class="loading-indicator" id="${loadingId}">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <span>Analyzing...</span>
      </div>
    `;
    messages.scrollTop = messages.scrollHeight;

    try {
      const data = await askQuestion(
        `Title: ${article.title}\n\n${article.body?.replace(/<[^>]*>/g, '')}`,
        question
      );
      document.getElementById(loadingId)?.remove();
      messages.innerHTML += `<div class="qa-message qa-message--ai">${escapeHtml(data.answer)}</div>`;
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      messages.innerHTML += `<div class="qa-message qa-message--ai" style="color: var(--danger);">Sorry, I couldn't process that question. Please try again.</div>`;
    }
    messages.scrollTop = messages.scrollHeight;
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
    const messages = document.getElementById('chat-messages');

    // Add user message
    messages.innerHTML += `
      <div class="chat-message chat-message--user">
        <div class="chat-message__content"><p>${escapeHtml(message)}</p></div>
      </div>
    `;

    // Add loading
    const loadingId = `chat-loading-${Date.now()}`;
    messages.innerHTML += `
      <div class="chat-message chat-message--ai" id="${loadingId}">
        <div class="chat-message__content">
          <div class="loading-indicator">
            <div class="loading-dots"><span></span><span></span><span></span></div>
            <span>Thinking...</span>
          </div>
        </div>
      </div>
    `;
    messages.scrollTop = messages.scrollHeight;

    try {
      const history = getState().chatHistory;
      const data = await sendChatMessage(message, history);

      document.getElementById(loadingId)?.remove();
      messages.innerHTML += `
        <div class="chat-message chat-message--ai">
          <div class="chat-message__content">${formatChatResponse(data.response)}</div>
        </div>
      `;

      setState({
        chatHistory: [
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content: data.response },
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

  // Handle routing
  window.addEventListener('hashchange', () => navigate(window.location.hash));

  // Initial route
  navigate(window.location.hash || '#/');
});
