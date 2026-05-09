export type Role = "ADMIN" | "ANNOTATOR" | "REVIEWER";
export type View = "dashboard" | "annotate" | "review" | "admin";

export type User = {
  id: number;
  username: string;
  email: string;
  whatsapp_number: string;
  role: Role;
  wallet_balance: number;
  is_active: boolean;
  trust_score: number;
};

export type Project = {
  id: number;
  name: string;
  task_type: "TEXT" | "AUDIO" | "IMAGE";
  base_reward_annotator: number;
  base_reward_reviewer: number;
  required_reviews: number;
  min_accuracy_threshold: number;
};

export type Task = {
  id: number;
  project_id: number;
  source_payload: Record<string, unknown>;
  status: string;
  locked_until?: string | null;
  storage_key?: string | null;
  claimed_by_id?: number | null;
};

export type Submission = {
  id: number;
  task: Task;
  annotator_id: number;
  result_payload: Record<string, unknown>;
  keystroke_count: number;
  time_spent_ms: number;
};

export type FraudAlert = {
  id: number;
  user_id: number;
  alert_type: string;
  description: string;
  resolved: boolean;
};

export type ImportJob = {
  id: number;
  project_id: number;
  hf_repo: string;
  subset?: string | null;
  split: string;
  row_limit: number;
  status: string;
  imported_count: number;
  skipped_count: number;
  error_message?: string | null;
};

export type AuditLog = {
  id: number;
  actor_id?: number | null;
  target_user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  description: string;
  metadata_json?: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
};
