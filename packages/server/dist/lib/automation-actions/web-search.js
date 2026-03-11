export async function executeWebSearch(config, _context, env, apiKey) {
    const { query, numResults = 5 } = config;
    const res = await fetch(`${env.BASICSOS_API_URL}/v1/execute/web/search`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, numResults }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Web search failed: ${res.status} ${text}`);
    }
    const data = (await res.json());
    return data.results;
}
