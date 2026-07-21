import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { writeFileSync, unlinkSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { Router } from "./router.js";
import { rewriteBody, buildUpstreamHeaders, buildUpstreamUrl } from "./rewriter.js";
import { UsageParser } from "./usage-parser.js";
import { computeCost, getPrice } from "../engine/cost.js";
import {
  appendMetric,
  getSessionId,
  writeSummary,
  loadAggregateFromDisk,
  getAggregate,
} from "../store/metrics.js";
import { nowISO } from "../util/format.js";
import { pidPath } from "../util/paths.js";
import type { Config } from "../schemas/config.js";

let server: ReturnType<typeof createServer> | null = null;
let router: Router | null = null;

function proxyLog(msg: string): void {
  try {
    const ts = new Date().toISOString();
    appendFileSync(pidPath().replace(/proxy\.pid$/, "proxy.log"), "[" + ts + "] " + msg + "\n");
  } catch { /* best effort */ }
}

export function isProxyRunning(): boolean {
  if (!existsSync(pidPath())) return false;
  try {
    const pid = parseInt(readFileSync(pidPath(), "utf-8").trim(), 10);
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export async function startProxy(): Promise<void> {
  router = new Router();
  const config = router.getConfig();

  // Log startup config
  proxyLog("START proxy on " + config.proxy.host + ":" + config.proxy.port);
  for (const [pName, pCfg] of Object.entries(config.providers)) {
    const keys = pCfg.modelMap ? Object.keys(pCfg.modelMap) : [];
    proxyLog("  provider " + pName + " modelMap: " + JSON.stringify(keys) + " → " + pCfg.baseUrl);
  }

  await loadAggregateFromDisk();
  await updateLiveSummary(config);
  router.startWatch();

  const proxyHost = config.proxy.host;
  const proxyPort = config.proxy.port;

  server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      proxyLog(">> " + (req.method ?? "?") + " " + (req.url ?? "/"));
      try {
        await handleRequest(req, res);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "proxy_error", message }));
        }
      }
    },
  );

  await new Promise<void>((resolve, reject) => {
    server!.listen(proxyPort, proxyHost, () => resolve());
    server!.on("error", reject);
  });

  writeFileSync(pidPath(), String(process.pid), "utf-8");

  const cleanup = () => {
    if (router) router.stopWatch();
    if (existsSync(pidPath())) unlinkSync(pidPath());
    server?.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  await new Promise(() => {});
}

export async function stopProxy(): Promise<void> {
  if (!existsSync(pidPath())) return;
  try {
    const pid = parseInt(readFileSync(pidPath(), "utf-8").trim(), 10);
    if (process.platform === "win32") {
      const { execSync } = await import("node:child_process");
      try {
        execSync("taskkill /PID " + pid + " /F /T", { stdio: "ignore" });
      } catch {
        /* already dead */
      }
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    /* process already dead */
  }
  if (existsSync(pidPath())) unlinkSync(pidPath());
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!router) throw new Error("Router not initialized");
  const config = router.getConfig();
  const route = router.getRoute();
  const method = req.method ?? "GET";
  // Strip query string — req.url may include "?beta=true" etc.
  const reqPath = (req.url ?? "/").split("?")[0]!;

  const providerName = route.provider;
  const provider = config.providers[providerName];
  if (!provider) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "unknown_provider",
        message: "Provider not found: " + providerName,
      }),
    );
    return;
  }

  if (method === "POST" && reqPath === "/v1/messages") {
    await handleMessagesRoute(
      req, res, config, providerName, provider, route.effectiveModel,
    );
    return;
  }

  await handlePassthrough(req, res, provider);
}

async function handleMessagesRoute(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
  providerName: string,
  provider: Config["providers"][string],
  effectiveModel: string,
): Promise<void> {
  const startTime = performance.now();
  const rawBody = await bufferBody(req);
  let bodyObj: Record<string, unknown>;
  try {
    bodyObj = JSON.parse(rawBody);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "invalid_json",
        message: "Request body is not valid JSON",
      }),
    );
    return;
  }

  const requestedModel = String(bodyObj.model ?? "unknown");

  // Always log incoming requests
  proxyLog("REQ model=" + requestedModel);

  // ── Model map check (active provider first, then fallback) ──
  let actualEffectiveModel = effectiveModel;
  let actualProvider = provider;
  let actualProviderName = providerName;

  // Priority 1: check the active provider's modelMap (allows one-click whole-provider switch)
  if (provider.modelMap && requestedModel in provider.modelMap) {
    actualEffectiveModel = provider.modelMap[requestedModel]!;
    proxyLog("MAP(active) " + requestedModel + " → " + actualEffectiveModel + " @ " + providerName);
  } else {
    // Priority 2: scan all other providers
    for (const [pName, pCfg] of Object.entries(config.providers)) {
      if (pName === providerName) continue; // already checked above
      if (pCfg.modelMap && requestedModel in pCfg.modelMap) {
        actualEffectiveModel = pCfg.modelMap[requestedModel]!;
        actualProviderName = pName;
        actualProvider = pCfg;
        proxyLog("MAP(fallback) " + requestedModel + " → " + actualEffectiveModel + " @ " + pName);
        break;
      }
    }
    if (actualEffectiveModel === effectiveModel && actualProviderName === providerName) {
      proxyLog("NOMAP " + requestedModel + " (no modelMap match for " + requestedModel + ", using default → " + effectiveModel + " @ " + providerName + ")");
    }
  }

  if (config.smallFastModel && isSmallModelRequest(bodyObj)) {
    actualEffectiveModel = config.smallFastModel.model;
    const sfmProvider = config.smallFastModel.provider;
    if (sfmProvider && config.providers[sfmProvider]) {
      actualProvider = config.providers[sfmProvider]!;
      actualProviderName = sfmProvider;
    }
  }

  // Strip [Nk]/[Nm] thinking budget suffix that some APIs reject
  const cleanModel = actualEffectiveModel.replace(/\[\d+[km]\]$/i, "");
  proxyLog("FWD model=" + cleanModel + " → " + actualProvider.baseUrl);
  const rewrittenBody = rewriteBody(bodyObj, cleanModel);
  const bodyStr = JSON.stringify(rewrittenBody);
  const upstreamHeaders = buildUpstreamHeaders(req.headers, actualProvider);
  upstreamHeaders["content-length"] = String(Buffer.byteLength(bodyStr));
  const upstreamUrl = buildUpstreamUrl(actualProvider.baseUrl, "/v1/messages");

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: bodyStr,
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!upstreamResp.ok) {
      const errorBody = await upstreamResp.text();
      res.writeHead(upstreamResp.status, {
        "Content-Type": "application/json",
      });
      res.end(errorBody);
      recordMetric({
        config, providerName: actualProviderName,
        requestedModel, effectiveModel: actualEffectiveModel,
        inputTokens: 0, outputTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        costUsd: 0, status: upstreamResp.status, latencyMs,
      });
      return;
    }

    const parser = new UsageParser();
    res.writeHead(
      upstreamResp.status,
      Object.fromEntries(upstreamResp.headers.entries()),
    );

    const reader = upstreamResp.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        res.write(result.value);
        const text = decoder.decode(result.value, { stream: !done });
        parser.feed(text);
      }
    }
    res.end();

    const usage = parser.getUsage();
    const price = getPrice(actualEffectiveModel, config.currency === "CNY" ? config.pricesCNY : config.pricesUSD);
    const costUsd = computeCost(usage, price);
    recordMetric({
      config, providerName: actualProviderName,
      requestedModel, effectiveModel: actualEffectiveModel,
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costUsd, status: upstreamResp.status, latencyMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_error", message }));
    }
  }
}

async function handlePassthrough(
  req: IncomingMessage,
  res: ServerResponse,
  provider: Config["providers"][string],
): Promise<void> {
  const reqPath = (req.url ?? "/").split("?")[0]!;
  proxyLog("PASSTHROUGH " + (req.method ?? "?") + " " + reqPath + " (no model rewrite)");
  const upstreamUrl = buildUpstreamUrl(provider.baseUrl, reqPath);
  const headers = buildUpstreamHeaders(req.headers, provider);
  let body: string | undefined;
  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "PATCH"
  ) {
    body = await bufferBody(req);
    headers["content-length"] = String(Buffer.byteLength(body));
  }
  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: req.method ?? "GET",
      headers,
      body: body || undefined,
    });
    res.writeHead(
      upstreamResp.status,
      Object.fromEntries(upstreamResp.headers.entries()),
    );
    if (upstreamResp.body) {
      const reader = upstreamResp.body.getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) res.write(result.value);
      }
    }
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_error", message }));
    }
  }
}

function bufferBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 10_000_000) {
        reject(new Error("Request body too large (>10MB)"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf-8")),
    );
    req.on("error", reject);
  });
}

function isSmallModelRequest(body: Record<string, unknown>): boolean {
  const maxTokens = body.max_tokens as number | undefined;
  const thinking = body.thinking as
    | { budget_tokens?: number }
    | undefined;
  if (
    maxTokens &&
    maxTokens <= 512 &&
    (!thinking || !thinking.budget_tokens)
  ) {
    return true;
  }
  return false;
}

interface MetricRecordParams {
  config: Config;
  providerName: string;
  requestedModel: string;
  effectiveModel: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  status: number;
  latencyMs: number;
}

function recordMetric(params: MetricRecordParams): void {
  appendMetric({
    ts: nowISO(),
    sessionId: getSessionId(),
    provider: params.providerName,
    requestedModel: params.requestedModel,
    effectiveModel: params.effectiveModel,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    cacheReadTokens: params.cacheReadTokens,
    cacheWriteTokens: params.cacheWriteTokens,
    costUsd: params.costUsd,
    status: params.status,
    latencyMs: params.latencyMs,
  });
  updateLiveSummary(params.config);
}

async function updateLiveSummary(config: Config): Promise<void> {
  if (!router) return;
  const route = router.getRoute();
  const agg = getAggregate();
  writeSummary({
    activeModel: route.provider,
    activeProvider: route.provider,
    budgetDailyUsd: config.budget?.dailyUsd,
    aggregates: agg,
    updatedAt: nowISO(),
  });
}
