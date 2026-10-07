const attempts = new Map<string, { count: number; lockedUntil: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    return { allowed: true };
  }

  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + WINDOW_MS;
    entry.count = 0;
    return { allowed: false, retryAfter: Math.ceil(WINDOW_MS / 1000) };
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil < now) {
    entry.count = 0;
    entry.lockedUntil = 0;
  }
  entry.count += 1;
  attempts.set(ip, entry);
}

export function resetAttempts(ip: string) {
  attempts.delete(ip);
}
