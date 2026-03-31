export interface SignalStatus {
  signals_active: boolean;
  signal_types: string[];
}

/**
 * v2.3: Fetch merchant signal status from the kyaLabs API.
 * Returns null on any failure (timeout, network, non-ok response) — graceful degradation.
 */
export async function fetchSignalStatus(
  domain: string,
  apiUrl: string
): Promise<SignalStatus | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `${apiUrl}/api/merchant/signal-status?domain=${encodeURIComponent(domain)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as SignalStatus;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
