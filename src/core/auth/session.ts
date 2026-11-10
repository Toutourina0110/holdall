import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "./server";

export type Session = NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>>;

export async function getSession(): Promise<Session | null> {
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") notFound();
  return session;
}

export async function apiSession(request: Request): Promise<Session | null> {
  return getAuth().api.getSession({ headers: request.headers });
}

export function unauthorized(): Response {
  return Response.json({ error: "Sign in to continue." }, { status: 401 });
}

export function forbidden(): Response {
  return Response.json({ error: "You do not have access to this." }, { status: 403 });
}
