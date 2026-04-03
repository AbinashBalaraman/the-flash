import { getStore } from '@netlify/blobs';

/**
 * DEBUG STORE: A transparent wrapper around Netlify Blobs to log every interaction.
 * Use this instead of direct getStore calls to see exactly what's happening.
 */
export function debugStore(name = "vibeathon-store") {
    const store = getStore(name);
    return {
        getJSON: async (key) => {
            console.log(`[🔍 BLOB READ] Checking key: ${key}...`);
            try {
                // v10+ get(key, { type: 'json' }) is the modern way
                const data = await store.get(key, { type: 'json' });
                if (data) {
                    console.log(`[✅ BLOB FOUND] Key: ${key}`);
                } else {
                    console.log(`[❌ BLOB MISSING] Key: ${key}`);
                }
                return data;
            } catch (err) {
                console.error(`[⚠️ BLOB ERROR] Read failed for ${key}:`, err.message);
                return null;
            }
        },
        setJSON: async (key, val) => {
            console.log(`[💾 BLOB WRITE] Updating key: ${key}...`);
            // store.getStore().set() handles both strings and blobs/files
            // We stringify explicitly to ensure consistency
            await store.set(key, JSON.stringify(val));
            console.log(`[✨ BLOB SAVED] Key: ${key} updated successfully.`);
        },
        list: async (options) => {
            console.log(`[📂 BLOB LIST] Listing keys...`);
            return await store.list(options);
        },
        delete: async (key) => {
            console.log(`[🗑️ BLOB DELETE] Removing key: ${key}...`);
            await store.delete(key);
            console.log(`[✅ BLOB DELETED] Key: ${key} removed.`);
        }
    };
}

/**
 * Robustly parses JSON from LLM output.
 * Handles markdown code blocks, weird leading/trailing text, and unescaped control characters in strings.
 */
export function safeParseJSON(text) {
    let cleaned = text.trim();
    
    // 1. Strip Markdown Wrappers
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
    }

    // 2. Standard Parse Attempt
    try {
        return JSON.parse(cleaned);
    } catch (initialError) {
        console.warn('[UTILS] Standard JSON parse failed. Attempting recovery...', initialError.message);
        
        try {
            // 3. Recovery: Escape literal control characters inside double-quoted strings
            // This regex finds content inside double quotes and escapes raw newlines/tabs
            const recovered = cleaned.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match, content) => {
                const escaped = content
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                return `"${escaped}"`;
            });
            
            return JSON.parse(recovered);
        } catch (recoveryError) {
            console.error('[UTILS] JSON recovery failed:', recoveryError.message);
            // Throw original error with some context
            throw new Error(`Invalid JSON format from LLM: ${initialError.message}. Content preview: ${cleaned.substring(0, 100)}...`);
        }
    }
}

/**
 * Appends a timestamped status message to a specific generation log in the Blob store.
 */
export async function pushLog(slug, message) {
    if (!slug) return;
    
    const store = getStore("vibeathon-store");
    const logKey = `logs_${slug}`;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = `[${timestamp}] ${message}`;

    try {
        let logs = [];
        try {
            logs = await store.get(logKey, { type: 'json' }) || [];
        } catch (readErr) {
            // Log might not exist yet
            logs = [];
        }

        logs.push(logEntry);
        
        // Capping at 25 entries to keep the UI snappy and store clean
        if (logs.length > 25) logs = logs.slice(-25);
        
        await store.set(logKey, JSON.stringify(logs));
        console.log(`[AGENT-LOG][${slug}] ${message}`);
    } catch (err) {
        console.error(`[UTILS] Failed to write log for ${slug}:`, err.message);
    }
}
