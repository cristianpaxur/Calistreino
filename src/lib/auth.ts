// Autenticação simples por senha única (app pessoal exposto publicamente).
// A senha fica só no env; o cookie guarda um token HMAC derivado dela.
// Compatível com Edge runtime (usa Web Crypto, sem dependências de Node).

export const AUTH_COOKIE = "calis_auth";

export interface AuthConfig {
  password: string;
  secret: string;
  enabled: boolean;
}

export function getAuthConfig(): AuthConfig {
  const password = process.env.APP_PASSWORD ?? "";
  // Se AUTH_SECRET não for definido, deriva do próprio password (menos ideal, mas funcional).
  const secret = process.env.AUTH_SECRET || password || "calistreino-dev";
  return { password, secret, enabled: password.trim().length > 0 };
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Token determinístico HMAC-SHA256(secret, "calistreino:"+password). */
export async function makeToken(password: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("calistreino:" + password));
  return toHex(sig);
}

/** Comparação em tempo constante para evitar timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
