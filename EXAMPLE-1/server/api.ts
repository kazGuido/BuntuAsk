import { Router } from 'express';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Mock Auth Middleware
router.use((req, res, next) => {
  const userId = req.headers['x-user-id'] as string || 'u1';
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  // @ts-ignore
  req.user = user;
  next();
});

// GET Current User Info
router.get('/me', (req, res) => {
  // @ts-ignore
  const user = req.user;
  res.json(user);
});

// GET 10 Available Tasks (and claim them)
router.post('/tasks/claim', (req, res) => {
  // @ts-ignore
  const user = req.user;
  
  if (user.role !== 'ANNOTATOR') {
    res.status(403).json({ error: 'Only annotators can claim tasks.' });
    return;
  }

  const result = db.transaction(() => {
    // Release expired locks
    db.prepare(`
      UPDATE tasks 
      SET status = 'AVAILABLE', locked_until = NULL, assigned_to = NULL
      WHERE status = 'CLAIMED' AND locked_until < datetime('now')
    `).run();

    // Check currently claimed by this user
    const currentClaimed = db.prepare(`
      SELECT * FROM tasks 
      WHERE status = 'CLAIMED' AND assigned_to = ? AND locked_until > datetime('now')
    `).all(user.id);

    if (currentClaimed.length > 0) {
      return currentClaimed;
    }

    // Claim up to 10 new tasks
    const tasksToClaim = db.prepare(`
      SELECT id FROM tasks 
      WHERE status = 'AVAILABLE'
      LIMIT 10
    `).all() as { id: string }[];

    if (tasksToClaim.length === 0) {
      return [];
    }

    const taskIds = tasksToClaim.map(t => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    
    // Lock for 30 minutes
    db.prepare(`
      UPDATE tasks 
      SET status = 'CLAIMED', assigned_to = ?, locked_until = datetime('now', '+30 minutes')
      WHERE id IN (${placeholders})
    `).run(user.id, ...taskIds);

    return db.prepare(`SELECT * FROM tasks WHERE id IN (${placeholders})`).all(...taskIds);
  })();

  res.json(result);
});

// SUBMIT a Task
router.post('/tasks/:id/submit', (req, res) => {
  // @ts-ignore
  const user = req.user;
  const taskId = req.params.id;
  const { content, metadata } = req.body;

  const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId) as any;
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assigned_to !== user.id) return res.status(403).json({ error: 'Not your task' });
  if (task.status !== 'CLAIMED') return res.status(400).json({ error: 'Task is not claimed' });

  db.transaction(() => {
    // 1. Create submission
    db.prepare(`
      INSERT INTO submissions (id, task_id, user_id, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), taskId, user.id, JSON.stringify(content), JSON.stringify(metadata));

    // 2. Update task status
    db.prepare(`
      UPDATE tasks SET status = 'SUBMITTED', locked_until = NULL WHERE id = ?
    `).run(taskId);
  })();

  res.json({ success: true });
});

// GET Review Queue
router.get('/review/queue', (req, res) => {
  // @ts-ignore
  const user = req.user;
  if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const submissions = db.prepare(`
    SELECT s.*, t.source_data, t.project_id 
    FROM submissions s
    JOIN tasks t ON s.task_id = t.id
    WHERE s.status = 'PENDING'
    LIMIT 10
  `).all();

  res.json(submissions);
});

// POST Review action
router.post('/review/:id', (req, res) => {
  // @ts-ignore
  const user = req.user;
  if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const submissionId = req.params.id;
  const { action, reason } = req.body; // action: 'APPROVE' | 'REJECT'

  const submission = db.prepare(`SELECT * FROM submissions WHERE id = ?`).get(submissionId) as any;
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'PENDING') return res.status(400).json({ error: 'Already reviewed' });

  const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(submission.task_id) as any;
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(task.project_id) as any;
  const annotatorId = submission.user_id;

  db.transaction(() => {
    if (action === 'APPROVE') {
      db.prepare(`UPDATE submissions SET status = 'APPROVED' WHERE id = ?`).run(submissionId);
      db.prepare(`UPDATE tasks SET status = 'APPROVED' WHERE id = ?`).run(submission.task_id);
      
      // PayAnnotator
      const annotatorReward = project.base_reward * task.difficulty_weight;
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ?, xp_points = xp_points + 15 WHERE id = ?`).run(annotatorReward, annotatorId);
      
      // PayReviewer
      const reviewerReward = 0.005;
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ?, xp_points = xp_points + 5 WHERE id = ?`).run(reviewerReward, user.id);

    } else {
      db.prepare(`UPDATE submissions SET status = 'REJECTED' WHERE id = ?`).run(submissionId);
      db.prepare(`UPDATE tasks SET status = 'REJECTED' WHERE id = ?`).run(submission.task_id); // Wait, better to put back to AVAILABLE or REJECTED. Let's put status='AVAILABLE' so it can be re-done? Or keep REJECTED and spawn a new task. Let's put REJECTED for now.
    }
  })();

  res.json({ success: true });
});

// TEST ONLY: Reset tasks back to available
router.post('/debug/reset-tasks', (req, res) => {
  db.prepare(`UPDATE tasks SET status = 'AVAILABLE', assigned_to = NULL, locked_until = NULL`).run();
  db.prepare(`DELETE FROM submissions`).run();
  db.prepare(`UPDATE users SET wallet_balance = 0, xp_points = 0`).run();
  res.json({ success: true });
});

export default router;
