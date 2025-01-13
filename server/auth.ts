import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import type { RequestHandler } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, colorAssignments, type SelectUser } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

// extend express user object with our schema
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express, sessionMiddleware: RequestHandler) {
  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
      }

      const { username, password } = result.data;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Get least recently used color from color assignments or create new one
      const avatarColors = [
        'hsl(10, 70%, 50%)',
        'hsl(40, 70%, 50%)',
        'hsl(70, 70%, 50%)',
        'hsl(100, 70%, 50%)',
        'hsl(130, 70%, 50%)',
        'hsl(160, 70%, 50%)',
        'hsl(190, 70%, 50%)',
        'hsl(220, 70%, 50%)',
        'hsl(250, 70%, 50%)',
        'hsl(280, 70%, 50%)',
        'hsl(310, 70%, 50%)',
        'hsl(340, 70%, 50%)',
      ];

      // Get color assignment with oldest last_used timestamp
      const [oldestColorAssignment] = await db
        .select()
        .from(colorAssignments)
        .orderBy(colorAssignments.lastUsed)
        .limit(1);

      let avatarColor: string;

      if (!oldestColorAssignment) {
        // No colors assigned yet, pick the first one
        avatarColor = avatarColors[0];
        await db.insert(colorAssignments).values({
          color: avatarColor,
        });
      } else {
        // Update the oldest color's timestamp and use it
        avatarColor = oldestColorAssignment.color;
        await db
          .update(colorAssignments)
          .set({ lastUsed: new Date() })
          .where(eq(colorAssignments.id, oldestColorAssignment.id));
      }

      const hashedPassword = await crypto.hash(password);

      await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          avatarColor,
        })
        .returning();

      return res.json({
        message: "Registration successful",
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
    }

    const cb = (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(400).send(info.message ?? "Login failed");
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        return res.json({
          message: "Login successful",
          user: { id: user.id, username: user.username },
        });
      });
    };
    passport.authenticate("local", cb)(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }

      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }

    res.status(401).send("Not logged in");
  });
}