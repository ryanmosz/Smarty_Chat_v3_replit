import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { channels, messages, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { setupWebSocket } from "./websocket";

export function registerRoutes(app: Express): Server {
  // Create HTTP server first
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = setupWebSocket(httpServer);
  app.set('wss', wss);

  // Channel routes
  app.get("/api/channels", async (_req, res) => {
    try {
      const allChannels = await db.select().from(channels);
      res.json(allChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ message: 'Failed to fetch channels' });
    }
  });

  // Channel messages route with user data
  app.get("/api/channels/:channelId/messages", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      if (isNaN(channelId)) {
        return res.status(400).json({ message: 'Invalid channel ID' });
      }

      const channelMessages = await db.query.messages.findMany({
        where: eq(messages.channelId, channelId),
        with: {
          user: true
        },
        orderBy: messages.createdAt,
      });

      res.json(channelMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const { name, description } = req.body;
      const [channel] = await db.insert(channels)
        .values({ name, description })
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
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ message: 'Invalid channel ID' });
    }

    try {
      // Use a transaction to ensure both operations succeed or fail together
      await db.transaction(async (tx) => {
        // First, delete all messages in the channel
        await tx.delete(messages)
          .where(eq(messages.channelId, channelId));

        // Then delete the channel
        const [deletedChannel] = await tx.delete(channels)
          .where(eq(channels.id, channelId))
          .returning();

        if (!deletedChannel) {
          throw new Error('Channel not found');
        }
      });

      // If we get here, both operations succeeded
      // Broadcast channel deletion to all connected clients
      wss.broadcast({
        type: 'channel_deleted',
        payload: { id: channelId }
      });

      res.json({ message: 'Channel deleted successfully' });
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting channel:', error);
      if (error.message === 'Channel not found') {
        res.status(404).json({ message: 'Channel not found' });
      } else {
        res.status(500).json({ message: 'Failed to delete channel' });
      }
    }
  });

  // Clean up WebSocket server on process exit
  process.on('SIGTERM', () => {
    wss.close();
    httpServer.close();
  });

  return httpServer;
}