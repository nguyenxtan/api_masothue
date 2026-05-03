import { AsyncLocalStorage } from "async_hooks";

export interface LookupContext {
  blockedHosts: Set<string>;
}

export const lookupContext = new AsyncLocalStorage<LookupContext>();

export function getLookupContext(): LookupContext | undefined {
  return lookupContext.getStore();
}

export function markBlocked(host: string): void {
  const ctx = lookupContext.getStore();
  if (ctx) ctx.blockedHosts.add(host);
}
