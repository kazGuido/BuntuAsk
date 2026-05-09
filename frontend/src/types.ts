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
  owner_id?: number | null;
  approved_by_id?: number | null;
  name: string;
  description: string;
  language: string;
  guidelines: string;
  sample_payload: Record<string, unknown>;
  task_type: "TEXT" | "AUDIO" | "IMAGE";
  workflow: "TRANSLATION" | "AUDIO_TRANSCRIPTION" | "VOICE_RECORDING" | "IMAGE_LABELING";
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "REJECTED";
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

export type NotificationDelivery = {
  id: number;
  channel: "IN_APP" | "WHATSAPP" | "EMAIL";
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
  destination?: string | null;
  error_message?: string | null;
};

export type Notification = {
  id: number;
  title: string;
  body: string;
  category: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  deliveries: NotificationDelivery[];
};
