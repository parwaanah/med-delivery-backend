function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function parseOriginList(raw: string): string[] {
  const s = String(raw || "").trim();
  if (!s) return [];
  if (s === "*") return ["*"];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function addDevOriginVariants(origins: string[]): string[] {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd) return origins;

  const out: string[] = [...origins];

  // Always allow common local frontend origins in dev.
  out.push("http://localhost:3000", "http://127.0.0.1:3000");

  for (const o of origins) {
    try {
      const u = new URL(o);
      if (u.hostname === "localhost") {
        out.push(`${u.protocol}//127.0.0.1${u.port ? `:${u.port}` : ""}`);
      }
      if (u.hostname === "127.0.0.1") {
        out.push(`${u.protocol}//localhost${u.port ? `:${u.port}` : ""}`);
      }
    } catch {
      // ignore invalid origin strings
    }
  }

  return unique(out);
}

export function getHttpCorsOrigins(): string[] {
  const raw = String(process.env.CORS_ORIGIN || "http://localhost:3000").trim();
  const list = parseOriginList(raw);
  const expanded = addDevOriginVariants(list.length ? list : ["http://localhost:3000"]);
  return expanded.includes("*") ? ["*"] : expanded;
}

export function getWsCorsOrigin(): string | string[] {
  const raw = String(process.env.WS_CORS_ORIGIN || process.env.CORS_ORIGIN || "").trim();
  const list = parseOriginList(raw);
  const expanded = addDevOriginVariants(list);

  if (!expanded.length) return "*";
  if (expanded.includes("*")) return "*";
  return expanded.length === 1 ? expanded[0] : expanded;
}

