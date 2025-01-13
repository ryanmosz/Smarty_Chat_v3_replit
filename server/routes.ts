import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { channels } from "@db/schema";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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
      res.json(channel);
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({ message: 'Failed to create channel' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}