import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import createMemoryStore from "memorystore";
import { setupAuth } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const MemoryStore = createMemoryStore(session);
const sessionMiddleware = session({
  secret: process.env.REPL_ID || "chat-app",
  resave: false,
  saveUninitialized: false,
  cookie: {},
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
});

// Setup authentication with the session middleware
setupAuth(app, sessionMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('Server Error:', err);
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const startServer = async (retries = 3) => {
    const BASE_PORT = 5000;

    for (let attempt = 0; attempt < retries; attempt++) {
      const port = BASE_PORT + attempt;
      try {
        await new Promise((resolve, reject) => {
          server.listen(port, "0.0.0.0", () => {
            log(`serving on port ${port}`);
            resolve(true);
          }).on('error', (err: any) => {
            if (err.code === 'EADDRINUSE' && attempt < retries - 1) {
              log(`Port ${port} in use, trying ${port + 1}...`);
              return;
            }
            reject(err);
          });
        });
        break; // If we get here, the server started successfully
      } catch (err: any) {
        if (attempt === retries - 1) {
          log(`Failed to start server after ${retries} attempts`);
          throw err;
        }
      }
    }
  };

  try {
    await startServer();
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
})();