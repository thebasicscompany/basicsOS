const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";

type TRPCResponse<T> = { result: { data: T } };

export const callTRPC = async <T>(
  procedure: string,
  input?: Record<string, unknown>,
): Promise<T> => {
  const url = `${API_URL}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input ?? {}))}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = (await res.json()) as TRPCResponse<T>;
  return json.result.data;
};
