import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { channels } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { setupWebSocket } from "./websocket";

export function registerRoutes(app: Express): Server {
  // Create HTTP server first so WebSocket can use the same server instance
  const httpServer = createServer(app);

  // Setup authentication before WebSocket server
  setupAuth(app);

  // Setup WebSocket server
  const wss = setupWebSocket(httpServer);
  app.set('wss', wss);

  // Basic channel routes
  app.get("/api/channels", async (_req, res) => {
    try {
      const allChannels = await db.select().from(channels);
      res.json(allChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ message: 'Failed to fetch channels' });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).send("Unauthorized");
      }

      const { name, description } = req.body;
      const [channel] = await db.insert(channels)
        .values({ name, description, createdById: req.user.id })
        .returning();

      // Broadcast channel creation to all connected clients
      wss.broadcast({
        type: 'channel_created',
        payload: channel
      });

      res.json(channel);
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({ message: 'Failed to create channel' });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).send("Unauthorized");
      }

      const channelId = parseInt(req.params.id);
      if (isNaN(channelId)) {
        return res.status(400).json({ message: 'Invalid channel ID' });
      }

      // Check if channel exists and user is the creator
      const [channel] = await db.select()
        .from(channels)
        .where(
          and(
            eq(channels.id, channelId),
            eq(channels.createdById, req.user.id)
          )
        );

      if (!channel) {
        return res.status(404).json({ message: 'Channel not found or unauthorized' });
      }

      await db.delete(channels)
        .where(eq(channels.id, channelId));

      // Broadcast channel deletion to all connected clients
      wss.broadcast({
        type: 'channel_deleted',
        payload: { id: channelId }
      });

      res.json({ message: 'Channel deleted successfully' });
    } catch (error) {
      console.error('Error deleting channel:', error);
      res.status(500).json({ message: 'Failed to delete channel' });
    }
  });

  // Clean up WebSocket server on process exit
  process.on('SIGTERM', () => {
    wss.close();
    httpServer.close();
  });

  return httpServer;
}