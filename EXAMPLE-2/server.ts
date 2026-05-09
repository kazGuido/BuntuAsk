import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cookieParser from "cookie-parser";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "buntu-secret-key-123";
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // Database setup
  const db = await open({
    filename: "./buntu.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'ANNOTATOR',
      xp_points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      current_streak INTEGER DEFAULT 0,
      last_active_at TEXT,
      wallet_balance REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      task_type TEXT,
      base_reward REAL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      source_data TEXT, -- JSON string
      difficulty_weight REAL DEFAULT 1.0,
      status TEXT DEFAULT 'AVAILABLE',
      locked_until TEXT,
      locked_by TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      user_id TEXT,
      content TEXT, -- JSON string
      metadata TEXT, -- JSON string (time_spent_ms, keystroke_count, etc)
      status TEXT DEFAULT 'PENDING',
      submitted_at TEXT,
      reviewed_by TEXT,
      review_reason TEXT,
      FOREIGN KEY(task_id) REFERENCES tasks(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      amount REAL,
      status TEXT DEFAULT 'PENDING',
      mobile_money_number TEXT,
      created_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Seed initial project and tasks if empty
  const projectCount = await db.get("SELECT COUNT(*) as count FROM projects");
  if (projectCount.count === 0) {
    const projectId = uuidv4();
    await db.run(
      "INSERT INTO projects (id, title, description, task_type, base_reward) VALUES (?, ?, ?, ?, ?)",
      [projectId, "Scholar Dataset V1.0", "Translate French academic text to Kirundi", "TEXT_TRANSLATION", 0.015]
    );

    const initialTasks = [
      { french: "L'éducation est la clé du développement durable." },
      { french: "La recherche scientifique nécessite une rigueur méthodologique." },
      { french: "Les technologies de l'information transforment la société moderne." },
      { french: "La préservation de l'environnement est un défi majeur du XXIe siècle." },
      { french: "L'intelligence artificielle ouvre de nouvelles perspectives pour l'humanité." },
      { french: "La démocratie repose sur la participation active des citoyens." },
      { french: "L'histoire est un guide précieux pour comprendre le présent." },
      { french: "La culture est le ciment qui unit une nation." },
      { french: "La santé publique est une priorité absolue pour tous les gouvernements." },
      { french: "L'innovation est le moteur de la croissance économique." },
      { french: "Le respect des droits de l'homme est fondamental pour la paix mondiale." },
      { french: "La littérature enrichit l'esprit et l'imagination." },
      { french: "Les mathématiques sont le langage universel de la science." },
      { french: "La philosophie nous invite à réfléchir sur le sens de la vie." },
      { french: "Le sport favorise la cohésion sociale et la santé physique." }
    ];

    for (const t of initialTasks) {
      await db.run(
        "INSERT INTO tasks (id, project_id, source_data, status) VALUES (?, ?, ?, ?)",
        [uuidv4(), projectId, JSON.stringify(t), "AVAILABLE"]
      );
    }
  }

  // Middleware to verify JWT
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const userId = uuidv4();
      await db.run(
        "INSERT INTO users (id, username, password) VALUES (?, ?, ?)",
        [userId, username, hashedPassword]
      );
      res.json({ message: "User registered successfully" });
    } catch (err) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
      res.cookie("token", token, { httpOnly: true });
      const { password: _, ...userWithoutPassword } = user;
      res.json({ token, user: userWithoutPassword });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/auth/me", authenticate, async (req: any, res) => {
    const user = await db.get("SELECT id, username, role, xp_points, level, current_streak, wallet_balance FROM users WHERE id = ?", [req.user.id]);
    res.json(user);
  });

  // Task Routes
  app.get("/api/tasks/available", authenticate, async (req, res) => {
    const tasks = await db.all("SELECT * FROM tasks WHERE status = 'AVAILABLE' OR (status = 'CLAIMED' AND locked_until < datetime('now')) LIMIT 20");
    res.json(tasks.map(t => ({ ...t, source_data: JSON.parse(t.source_data) })));
  });

  app.post("/api/tasks/claim", authenticate, async (req: any, res) => {
    const { count = 10 } = req.body;
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    // Claim available tasks
    const tasksToClaim = await db.all(
      "SELECT id FROM tasks WHERE status = 'AVAILABLE' OR (status = 'CLAIMED' AND locked_until < datetime('now')) LIMIT ?",
      [count]
    );

    if (tasksToClaim.length === 0) {
      return res.status(404).json({ error: "No tasks available" });
    }

    const taskIds = tasksToClaim.map(t => t.id);
    const placeholders = taskIds.map(() => "?").join(",");
    
    await db.run(
      `UPDATE tasks SET status = 'CLAIMED', locked_until = ?, locked_by = ? WHERE id IN (${placeholders})`,
      [lockedUntil, req.user.id, ...taskIds]
    );

    const claimedTasks = await db.all(`SELECT * FROM tasks WHERE id IN (${placeholders})`, taskIds);
    res.json(claimedTasks.map(t => ({ ...t, source_data: JSON.parse(t.source_data) })));
  });

  app.post("/api/tasks/submit", authenticate, async (req: any, res) => {
    const { taskId, content, metadata } = req.body;
    const submissionId = uuidv4();
    const now = new Date().toISOString();

    // Check if task is claimed by user
    const task = await db.get("SELECT * FROM tasks WHERE id = ? AND locked_by = ? AND status = 'CLAIMED'", [taskId, req.user.id]);
    if (!task) return res.status(403).json({ error: "Task not claimed or expired" });

    // Keystroke validation backend check
    const contentText = content.kirundi || "";
    if (metadata.keystroke_count < (contentText.length * 0.7)) {
      // Still allow submission but maybe flag it? 
      // Requirement says "Flag as AI/Bot" or "Backend Rejection Rule"
      // Let's implement rejection as per spec: "If keystroke_count < (content_length * 0.7) -> Flag as AI/Bot."
      // Actually "Backend Rejection Rule" suggests we should reject.
      return res.status(400).json({ error: "Low keystroke density detected. Please type manually." });
    }

    await db.run(
      "INSERT INTO submissions (id, task_id, user_id, content, metadata, submitted_at) VALUES (?, ?, ?, ?, ?, ?)",
      [submissionId, taskId, req.user.id, JSON.stringify(content), JSON.stringify(metadata), now]
    );

    await db.run("UPDATE tasks SET status = 'SUBMITTED', locked_by = NULL, locked_until = NULL WHERE id = ?", [taskId]);

    res.json({ message: "Task submitted successfully", submissionId });
  });

  // Admin/Reviewer Routes
  app.get("/api/review/queue", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN" && req.user.role !== "REVIEWER") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const queue = await db.all(`
      SELECT s.*, t.source_data, u.username as submitter_name
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'PENDING'
      LIMIT 20
    `);
    res.json(queue.map(s => ({
      ...s,
      content: JSON.parse(s.content),
      metadata: JSON.parse(s.metadata),
      source_data: JSON.parse(s.source_data)
    })));
  });

  app.post("/api/review/action", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN" && req.user.role !== "REVIEWER") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { submissionId, action, reason } = req.body; // action: 'APPROVE' or 'REJECT'
    
    const submission = await db.get("SELECT * FROM submissions WHERE id = ?", [submissionId]);
    if (!submission) return res.status(404).json({ error: "Submission not found" });

    if (action === "APPROVE") {
      await db.run("UPDATE submissions SET status = 'APPROVED', reviewed_by = ? WHERE id = ?", [req.user.id, submissionId]);
      await db.run("UPDATE tasks SET status = 'APPROVED' WHERE id = ?", [submission.task_id]);

      // Credit User
      const project = await db.get("SELECT base_reward FROM projects p JOIN tasks t ON p.id = t.project_id WHERE t.id = ?", [submission.task_id]);
      const reward = project.base_reward;
      
      await db.run(
        "UPDATE users SET wallet_balance = wallet_balance + ?, xp_points = xp_points + 10 WHERE id = ?",
        [reward, submission.user_id]
      );
    } else {
      await db.run("UPDATE submissions SET status = 'REJECTED', reviewed_by = ?, review_reason = ? WHERE id = ?", [req.user.id, reason, submissionId]);
      await db.run("UPDATE tasks SET status = 'AVAILABLE' WHERE id = ?", [submission.task_id]);
    }

    res.json({ message: `Submission ${action.toLowerCase()}d` });
  });

  // Leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    const leaders = await db.all("SELECT id, username, xp_points, level FROM users ORDER BY xp_points DESC LIMIT 10");
    res.json(leaders);
  });

  // User Stats & Streak
  app.post("/api/user/session-complete", authenticate, async (req: any, res) => {
    const user = await db.get("SELECT id, current_streak, last_active_at, xp_points FROM users WHERE id = ?", [req.user.id]);
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const lastActive = user.last_active_at ? user.last_active_at.split("T")[0] : null;

    let newStreak = user.current_streak;
    let bonusXp = 0;
    let streakMessage = "";

    if (lastActive === today) {
      // Already active today, streak stays the same
      streakMessage = "Session completed! Keep it up.";
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastActive === yesterdayStr) {
        newStreak += 1;
        streakMessage = `Daily streak increased to ${newStreak}!`;
        
        // Award bonus every 3 days
        if (newStreak % 3 === 0) {
          bonusXp = 50; // Bonus XP for 3-day milestone
          streakMessage += ` 3-day bonus: +${bonusXp} XP!`;
        }
      } else {
        newStreak = 1;
        streakMessage = "New daily streak started!";
      }
    }

    await db.run(
      "UPDATE users SET current_streak = ?, last_active_at = ?, xp_points = xp_points + ? WHERE id = ?",
      [newStreak, now.toISOString(), bonusXp, req.user.id]
    );

    res.json({ 
      success: true, 
      newStreak, 
      bonusXp, 
      message: streakMessage 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
