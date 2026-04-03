import { getStore } from '@netlify/blobs';

export default async function handler(req, context) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    try {
        const store = getStore("vibeathon-store");
        const url = new URL(req.url);
        
        // --- DELETE ALL ---
        if (url.searchParams.get('clear') === 'true') {
             const list = await store.list();
             for (const item of list.blobs) {
                await store.delete(item.key);
             }
             return new Response(JSON.stringify({ success: true, message: `Cleared ${list.blobs.length} keys.` }), {
                 headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
             });
        }

        // --- LIST ALL ---
        const list = await store.list();
        const results = {};
        
        for (const item of list.blobs) {
            try {
                const data = await store.get(item.key, { type: 'json' });
                results[item.key] = {
                    status: data?.isGenerating ? 'GENERATING' : 'COMPLETE',
                    hasError: !!data?.error,
                    timestamp: data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A',
                    keysPresent: Object.keys(data || {}),
                    snippet: data?.title || data?.date || 'N/A'
                };
            } catch (err) {
                results[item.key] = { status: 'ERROR', error: err.message };
            }
        }

        return new Response(JSON.stringify({
            count: list.blobs.length,
            storeName: "vibeathon-store",
            items: results
        }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

export const config = {
    path: '/api/debug-blobs',
};
