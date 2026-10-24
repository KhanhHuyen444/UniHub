export async function checkBackend(signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Backend chưa sẵn sàng.');

  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !('status' in body) ||
    body.status !== 'ok' ||
    !('service' in body) ||
    body.service !== 'unihub-api'
  ) {
    throw new Error('Phản hồi health không đúng định dạng.');
  }
}
