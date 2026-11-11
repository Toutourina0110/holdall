export const launchCookie = "holdall_launch";

function sameToken(expected: string, given: string | undefined): boolean {
  if (!given || given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ given.charCodeAt(index);
  return difference === 0;
}

export function desktopGate(input: {
  token: string | undefined;
  port: number;
  host: string | undefined;
  cookieToken?: string;
  queryToken?: string;
}): "allow" | "set-cookie" | "deny" {
  if (!input.token || input.token.length < 32) return "deny";
  if (input.host !== `127.0.0.1:${input.port}` && input.host !== `localhost:${input.port}`) return "deny";
  if (sameToken(input.token, input.cookieToken)) return "allow";
  if (sameToken(input.token, input.queryToken)) return "set-cookie";
  return "deny";
}
