/* ═══════════════════════════════════════════════════════
   STATE — Simple reactive state management
   ═══════════════════════════════════════════════════════ */

const state = {
  currentPage: 'feed',
  articles: [],
  currentArticle: null,
  digest: null,
  chatHistory: [],
  qaHistory: [],
  isLoading: {
    feed: false,
    article: false,
    digest: false,
    chat: false,
    qa: false,
  },
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(updates) {
  Object.assign(state, updates);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLoading(key, value) {
  state.isLoading = { ...state.isLoading, [key]: value };
  listeners.forEach(fn => fn(state));
}
