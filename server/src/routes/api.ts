import { Hono } from "hono";
import type { SessionStore } from "../session-store.js";
import type { AgentRunner } from "../agent-runner.js";
import type { ConnectionManager } from "../connection-manager.js";
import type { MessageStore } from "../message-store.js";
import type { FeishuBridge } from "../feishu/feishu-bridge.js";
import type { CreateSessionRequest, UpdateSessionRequest } from "@webclaude/shared";
import { AVAILABLE_MODELS } from "@webclaude/shared";

export function createApiRoutes(
  sessionStore: SessionStore,
  agentRunner: AgentRunner,
  connectionManager: ConnectionManager,
  messageStore: MessageStore,
  feishuBridge: FeishuBridge | null = null,
) {
  const api = new Hono();

  // List all sessions
  api.get("/sessions", (c) => {
    return c.json(sessionStore.getAll());
  });

  // Create a new session
  api.post("/sessions", async (c) => {
    const body = (await c.req.json()) as CreateSessionRequest;
    const session = sessionStore.create(body);
    connectionManager.broadcastAll({
      type: "session_update",
      session,
    });
    return c.json(session, 201);
  });

  // Get a single session
  api.get("/sessions/:id", (c) => {
    const session = sessionStore.get(c.req.param("id"));
    if (!session) return c.json({ error: "Not found" }, 404);
    return c.json(session);
  });

  // Update a session
  api.patch("/sessions/:id", async (c) => {
    const body = (await c.req.json()) as UpdateSessionRequest;
    const session = sessionStore.update(c.req.param("id"), body);
    if (!session) return c.json({ error: "Not found" }, 404);
    connectionManager.broadcastAll({
      type: "session_update",
      session,
    });
    return c.json(session);
  });

  // Get messages for a session
  api.get("/sessions/:id/messages", (c) => {
    const id = c.req.param("id");
    const session = sessionStore.get(id);
    if (!session) return c.json({ error: "Not found" }, 404);
    return c.json(messageStore.getAll(id));
  });

  // Delete a session
  api.delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    // Kill running agent if any
    if (agentRunner.isRunning(id)) {
      await agentRunner.interrupt(id);
    }
    messageStore.delete(id);
    const deleted = sessionStore.delete(id);
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  // List available models
  api.get("/models", (c) => {
    return c.json(AVAILABLE_MODELS);
  });

  // ── Feishu integration routes ───────────────────────────────────────────────

  /** GET /api/feishu/status – returns bridge status or disabled notice. */
  api.get("/feishu/status", (c) => {
    if (!feishuBridge) {
      return c.json({
        enabled: false,
        message:
          'Feishu integration disabled. Set enabled=true in ~/.openclaw/config.json',
      });
    }
    return c.json(feishuBridge.getStatus());
  });

  /** POST /api/feishu/send – manually send a message to a Feishu DM session.
   *  Body: { sessionId: string, text: string }
   */
  api.post("/feishu/send", async (c) => {
    if (!feishuBridge) {
      return c.json({ error: "Feishu integration not enabled" }, 503);
    }
    const { sessionId, text } = (await c.req.json()) as {
      sessionId: string;
      text: string;
    };
    if (!sessionId || !text) {
      return c.json({ error: "sessionId and text are required" }, 400);
    }
    if (!feishuBridge.isFeishuSession(sessionId)) {
      return c.json({ error: "Not a Feishu session" }, 404);
    }
    await feishuBridge.forwardReplyToFeishu(sessionId, text);
    return c.json({ ok: true });
  });

  return api;
}
