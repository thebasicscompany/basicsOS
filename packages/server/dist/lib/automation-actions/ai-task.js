export async function executeAI(config, _context, apiKey, env) {
    const { prompt, model = "claude-sonnet-4-5-20251001" } = config;
    const response = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            stream: false,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI request failed (${response.status}): ${text}`);
    }
    const data = (await response.json());
    return {
        result: data.choices[0]?.message?.content ?? "",
        usage: {
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            model,
        },
    };
}
