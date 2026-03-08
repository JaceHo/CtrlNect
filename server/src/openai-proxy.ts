/**
 * openai-proxy.ts
 *
 * An inline local HTTP proxy (Bun.serve) that translates between the
 * Anthropic Messages API format (what the Claude Agent SDK / claude CLI sends)
 * and the OpenAI Chat Completions API format (what OpenAI-compatible endpoints speak).
 *
 * Flow:
 *   claude CLI  →  POST /v1/messages (Anthropic format)
 *               →  [this proxy]
 *               →  POST /v1/chat/completions (OpenAI format)  →  real endpoint
 *               ←  [translated response back to Anthropic SSE format]
 *               ←  claude CLI
 *
 * No external dependencies — pure Bun HTTP server + fetch.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image" | "thinking";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequest {
  model: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  stream?: boolean;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIRequest {
  model: string;
  max_tokens?: number;
  temperature?: number;
  messages: OpenAIMessage[];
  tools?: OpenAIToolDef[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
}

interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ── Request translation: Anthropic → OpenAI ────────────────────────────────────

function convertMessages(
  system: string | undefined,
  messages: AnthropicMessage[],
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        result.push({ role: "user", content: msg.content });
        continue;
      }

      const blocks = msg.content as AnthropicContentBlock[];
      const toolResults = blocks.filter((b) => b.type === "tool_result");
      const textBlocks = blocks.filter((b) => b.type === "text");

      if (toolResults.length > 0 && textBlocks.length === 0) {
        // Pure tool results → OpenAI tool messages (one per result)
        for (const tr of toolResults) {
          const content =
            typeof tr.content === "string"
              ? tr.content
              : Array.isArray(tr.content)
                ? (tr.content as AnthropicContentBlock[])
                    .filter((b) => b.type === "text")
                    .map((b) => b.text)
                    .join("")
                : "";
          result.push({
            role: "tool",
            content,
            tool_call_id: tr.tool_use_id || "",
          });
        }
      } else {
        const text = textBlocks.map((b) => b.text).join("\n");
        result.push({ role: "user", content: text });
      }
    } else if (msg.role === "assistant") {
      if (typeof msg.content === "string") {
        result.push({ role: "assistant", content: msg.content });
        continue;
      }

      const blocks = msg.content as AnthropicContentBlock[];
      const textBlocks = blocks.filter((b) => b.type === "text");
      const toolUseBlocks = blocks.filter((b) => b.type === "tool_use");

      const assistantMsg: OpenAIMessage = {
        role: "assistant",
        content: textBlocks.map((b) => b.text).join("") || null,
      };

      if (toolUseBlocks.length > 0) {
        assistantMsg.tool_calls = toolUseBlocks.map((b) => ({
          id: b.id || `call_${Date.now()}`,
          type: "function" as const,
          function: {
            name: b.name || "",
            arguments: JSON.stringify(b.input ?? {}),
          },
        }));
      }

      result.push(assistantMsg);
    }
  }

  return result;
}

function convertTools(tools: AnthropicTool[] | undefined): OpenAIToolDef[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema,
    },
  }));
}

function buildOpenAIRequest(body: AnthropicRequest, targetModel: string): OpenAIRequest {
  const req: OpenAIRequest = {
    model: targetModel,
    messages: convertMessages(body.system, body.messages),
    stream: body.stream ?? false,
  };

  if (body.max_tokens) req.max_tokens = body.max_tokens;
  if (body.temperature !== undefined) req.temperature = body.temperature;

  const tools = convertTools(body.tools);
  if (tools) req.tools = tools;

  if (body.stream) {
    req.stream_options = { include_usage: true };
  }

  return req;
}

// ── Non-streaming response translation: OpenAI → Anthropic ────────────────────

function convertNonStreamResponse(openaiResp: Record<string, unknown>, originalModel: string): Record<string, unknown> {
  const choices = openaiResp.choices as { message: OpenAIMessage; finish_reason: string }[];
  const choice = choices?.[0];
  const msg = choice?.message;

  const content: Record<string, unknown>[] = [];

  if (msg?.content) {
    content.push({ type: "text", text: msg.content });
  }

  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      let input: unknown = {};
      try { input = JSON.parse(tc.function.arguments || "{}"); } catch {}
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  }

  const usage = openaiResp.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

  return {
    id: openaiResp.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model: originalModel,
    stop_reason: choice?.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  };
}

// ── Streaming translation: OpenAI SSE → Anthropic SSE ─────────────────────────

interface ActiveToolCall {
  anthropicBlockIndex: number;
  id: string;
  name: string;
}

async function* convertStream(
  openaiStream: ReadableStream<Uint8Array>,
  originalModel: string,
): AsyncGenerator<string> {
  const reader = openaiStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Track content block indices
  let nextBlockIndex = 0;
  let textBlockIndex = -1;           // -1 = no active text block
  const toolCallMap = new Map<number, ActiveToolCall>(); // openai tc index → state

  let inputTokens = 0;
  let outputTokens = 0;

  const msgId = `msg_proxy_${Date.now()}`;

  // ── message_start ────────────────────────────────────────────────────────
  yield `event: message_start\ndata: ${JSON.stringify({
    type: "message_start",
    message: {
      id: msgId,
      type: "message",
      role: "assistant",
      content: [],
      model: originalModel,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  })}\n\n`;

  yield `event: ping\ndata: ${JSON.stringify({ type: "ping" })}\n\n`;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") {
          // Close any open text block
          if (textBlockIndex >= 0) {
            yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: textBlockIndex })}\n\n`;
            textBlockIndex = -1;
          }
          // Close any open tool blocks
          for (const [, tc] of toolCallMap) {
            yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: tc.anthropicBlockIndex })}\n\n`;
          }
          toolCallMap.clear();

          yield `event: message_delta\ndata: ${JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: Math.max(1, outputTokens) },
          })}\n\n`;
          yield `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
          return;
        }

        let chunk: {
          choices?: Array<{
            index: number;
            delta: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                type?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try { chunk = JSON.parse(raw); } catch { continue; }

        // Capture usage if included
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        // ── Text delta ──────────────────────────────────────────────────────
        if (delta.content) {
          if (textBlockIndex < 0) {
            textBlockIndex = nextBlockIndex++;
            yield `event: content_block_start\ndata: ${JSON.stringify({
              type: "content_block_start",
              index: textBlockIndex,
              content_block: { type: "text", text: "" },
            })}\n\n`;
          }
          yield `event: content_block_delta\ndata: ${JSON.stringify({
            type: "content_block_delta",
            index: textBlockIndex,
            delta: { type: "text_delta", text: delta.content },
          })}\n\n`;
        }

        // ── Tool call deltas ────────────────────────────────────────────────
        if (delta.tool_calls) {
          // Close any open text block first
          if (textBlockIndex >= 0) {
            yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: textBlockIndex })}\n\n`;
            textBlockIndex = -1;
          }

          for (const tc of delta.tool_calls) {
            const tcIdx = tc.index ?? 0;

            if (tc.id && tc.function?.name) {
              // New tool call starting
              const blockIdx = nextBlockIndex++;
              toolCallMap.set(tcIdx, {
                anthropicBlockIndex: blockIdx,
                id: tc.id,
                name: tc.function.name,
              });
              yield `event: content_block_start\ndata: ${JSON.stringify({
                type: "content_block_start",
                index: blockIdx,
                content_block: { type: "tool_use", id: tc.id, name: tc.function.name, input: {} },
              })}\n\n`;
            }

            if (tc.function?.arguments) {
              const existing = toolCallMap.get(tcIdx);
              if (existing) {
                yield `event: content_block_delta\ndata: ${JSON.stringify({
                  type: "content_block_delta",
                  index: existing.anthropicBlockIndex,
                  delta: { type: "input_json_delta", partial_json: tc.function.arguments },
                })}\n\n`;
              }
            }
          }
        }

        // ── finish_reason ───────────────────────────────────────────────────
        if (choice.finish_reason) {
          if (textBlockIndex >= 0) {
            yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: textBlockIndex })}\n\n`;
            textBlockIndex = -1;
          }
          for (const [, tc] of toolCallMap) {
            yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: tc.anthropicBlockIndex })}\n\n`;
          }
          toolCallMap.clear();

          const stopReason = choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn";
          yield `event: message_delta\ndata: ${JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: stopReason, stop_sequence: null },
            usage: { output_tokens: Math.max(1, outputTokens) },
          })}\n\n`;
          yield `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Fallback close — stream ended without [DONE] or finish_reason
  yield `event: message_delta\ndata: ${JSON.stringify({
    type: "message_delta",
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: Math.max(1, outputTokens) },
  })}\n\n`;
  yield `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
}

// ── Proxy server lifecycle ─────────────────────────────────────────────────────

let proxyServer: ReturnType<typeof Bun.serve> | null = null;
export let proxyPort = 0;

export function startOpenAIProxy(
  openaiBaseUrl: string,
  openaiApiKey: string,
  openaiModel: string,
): number {
  if (proxyServer) return proxyPort;

  proxyPort = 19876; // fixed local port
  const targetBase = openaiBaseUrl.replace(/\/$/, "");

  proxyServer = Bun.serve({
    port: proxyPort,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method !== "POST" || url.pathname !== "/v1/messages") {
        return new Response("Not found", { status: 404 });
      }

      let body: AnthropicRequest;
      try {
        body = (await req.json()) as AnthropicRequest;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const openaiBody = buildOpenAIRequest(body, openaiModel);
      const targetUrl = `${targetBase}/chat/completions`;

      let upstreamResp: Response;
      try {
        upstreamResp = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(openaiBody),
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: { type: "api_error", message: String(err) } }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }

      if (!upstreamResp.ok) {
        const errText = await upstreamResp.text();
        console.error(`[OpenAI Proxy] Upstream error ${upstreamResp.status}: ${errText}`);
        return new Response(
          JSON.stringify({ error: { type: "api_error", message: errText } }),
          { status: upstreamResp.status, headers: { "Content-Type": "application/json" } },
        );
      }

      if (body.stream && upstreamResp.body) {
        const gen = convertStream(upstreamResp.body, body.model);
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await gen.next();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(new TextEncoder().encode(value));
            }
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } else {
        const respJson = (await upstreamResp.json()) as Record<string, unknown>;
        const translated = convertNonStreamResponse(respJson, body.model);
        return new Response(JSON.stringify(translated), {
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  });

  console.log(`[OpenAI Proxy] Listening :${proxyPort} → ${targetBase}`);
  return proxyPort;
}

export function stopOpenAIProxy() {
  if (proxyServer) {
    proxyServer.stop();
    proxyServer = null;
    console.log("[OpenAI Proxy] Stopped");
  }
}
