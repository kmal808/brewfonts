const KEY = "bf-device-id";

let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;
  cached = localStorage.getItem(KEY);
  if (!cached) {
    cached = crypto.randomUUID();
    localStorage.setItem(KEY, cached);
  }
  return cached;
}
