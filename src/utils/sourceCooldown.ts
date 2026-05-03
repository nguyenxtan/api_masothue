const cooldowns = new Map<string, number>();

export function setCooldown(host: string, seconds: number): void {
  cooldowns.set(host, Date.now() + seconds * 1000);
}

export function getCooldownRemainingSeconds(host: string): number {
  const expiresAt = cooldowns.get(host);
  if (!expiresAt) return 0;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    cooldowns.delete(host);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export function isInCooldown(host: string): boolean {
  return getCooldownRemainingSeconds(host) > 0;
}

export function clearAllCooldowns(): void {
  cooldowns.clear();
}
