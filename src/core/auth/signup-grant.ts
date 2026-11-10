import { AsyncLocalStorage } from "node:async_hooks";

const grant = new AsyncLocalStorage<{ role: "admin" | "user" }>();

export function withSignupGrant<T>(role: "admin" | "user", run: () => Promise<T>): Promise<T> {
  return grant.run({ role }, run);
}

export function currentSignupGrant(): { role: "admin" | "user" } | undefined {
  return grant.getStore();
}
