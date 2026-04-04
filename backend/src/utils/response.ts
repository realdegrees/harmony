const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

export function error(message: string, status = 400, code?: string): Response {
  return new Response(
    JSON.stringify({
      code: code ?? 'ERROR',
      message,
    }),
    {
      status,
      headers: JSON_HEADERS,
    },
  );
}
