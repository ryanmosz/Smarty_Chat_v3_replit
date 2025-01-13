import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { messages, channels, reactions, directMessages } from "@db/schema";
import { eq, like, and, or } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);
  
  // Channels
  app.get("/api/channels", async (req, res) => {
    const allChannels = await db.select().from(channels);
    res.json(allChannels);
  });

  app.post("/api/channels", async (req, res) => {
    const { name, description } = req.body;
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const [channel] = await db.insert(channels)
      .values({ name, description, createdById: req.user.id })
      .returning();
    res.json(channel);
  });

  // Messages
  app.get("/api/channels/:channelId/messages", async (req, res) => {
    const { channelId } = req.params;
    const channelMessages = await db.select()
      .from(messages)
      .where(and(
        eq(messages.channelId, parseInt(channelId)),
        eq(messages.isDeleted, false)
      ));
    res.json(channelMessages);
  });

  // Thread messages
  app.get("/api/messages/:messageId/thread", async (req, res) => {
    const { messageId } = req.params;
    const threadMessages = await db.select()
      .from(messages)
      .where(eq(messages.threadParentId, parseInt(messageId)));
    res.json(threadMessages);
  });

  // Direct messages
  app.get("/api/dm/:userId", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const { userId } = req.params;
    
    const dms = await db.select()
      .from(directMessages)
      .where(or(
        and(
          eq(directMessages.fromUserId, req.user.id),
          eq(directMessages.toUserId, parseInt(userId))
        ),
        and(
          eq(directMessages.fromUserId, parseInt(userId)),
          eq(directMessages.toUserId, req.user.id)
        )
      ));
    res.json(dms);
  });

  // Search
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (typeof q !== "string") return res.status(400).send("Invalid query");
    
    const searchResults = await db.select()
      .from(messages)
      .where(like(messages.content, `%${q}%`));
    res.json(searchResults);
  });

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}
