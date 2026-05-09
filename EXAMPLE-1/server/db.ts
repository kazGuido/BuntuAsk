import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store DB in the root directory
const dbPath = path.join(__dirname, '..', 'buntu.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'ANNOTATOR',
    xp_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    wallet_balance REAL DEFAULT 0.0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT NOT NULL,
    base_reward REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    source_data TEXT NOT NULL,
    difficulty_weight REAL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    locked_until DATETIME,
    assigned_to TEXT REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    metadata TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    mobile_money_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed some initial data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (count.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (id, username, role) VALUES (?, ?, ?)');
  insertUser.run('u1', 'annotator_1', 'ANNOTATOR');
  insertUser.run('u2', 'reviewer_1', 'REVIEWER');
  
  const insertProject = db.prepare('INSERT INTO projects (id, title, description, task_type, base_reward) VALUES (?, ?, ?, ?, ?)');
  insertProject.run('p1', 'French to Kirundi Scholar', 'Translate "Scholar" subset of the Luth-SFT paper', 'TEXT_TRANSLATION', 0.015);
  
  const insertTask = db.prepare('INSERT INTO tasks (id, project_id, source_data, status) VALUES (?, ?, ?, ?)');
  const frenchSentences = [
    "L'intelligence artificielle transforme le monde.",
    "L'apprentissage automatique permet aux ordinateurs d'apprendre sans être explicitement programmés.",
    "Les réseaux de neurones s'inspirent du cerveau humain.",
    "Le traitement du langage naturel est un domaine de l'IA.",
    "Les modèles de langage de grande taille nécessitent d'énormes quantités de données.",
    "La vision par ordinateur permet aux machines de voir.",
    "L'éthique de l'IA est un sujet très important.",
    "Les biais dans les données peuvent entraîner des modèles biaisés.",
    "L'apprentissage par renforcement est utilisé dans la robotique.",
    "La traduction automatique s'est beaucoup améliorée ces dernières années."
  ];
  
  for (let i = 0; i < frenchSentences.length; i++) {
    const sourceData = JSON.stringify({ french: frenchSentences[i] });
    insertTask.run(`t${i+1}`, 'p1', sourceData, 'AVAILABLE');
  }
}

export default db;
