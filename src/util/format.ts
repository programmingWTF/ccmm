export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function formatUsd(n: number): string { return "$" + n.toFixed(2); }

export function currencySymbol(currency: "USD" | "CNY"): string {
  return currency === "CNY" ? "¥" : "$";
}

export function formatCost(n: number, currency: "USD" | "CNY" = "USD"): string {
  return currencySymbol(currency) + n.toFixed(2);
}

export function formatPercent(rate: number): string { return Math.round(rate * 100) + "%"; }

export function nowISO(): string { return new Date().toISOString(); }

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function generateSessionId(): string { return Math.random().toString(36).slice(2, 10); }

export function shortModelName(full: string): string {
  let s = full.replace(/^claude-/, "");
  const parts = s.split("-");
  if (parts.length >= 2) {
    const name = parts[0];
    const versionParts = parts.slice(1).filter(p => /^\d/.test(p));
    if (versionParts.length > 0) return name + "-" + versionParts.join(".");
  }
  return s;
}
