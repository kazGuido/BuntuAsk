export enum UserRole {
  ADMIN = "ADMIN",
  ANNOTATOR = "ANNOTATOR",
  REVIEWER = "REVIEWER",
}

export enum TaskStatus {
  AVAILABLE = "AVAILABLE",
  CLAIMED = "CLAIMED",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  xp_points: number;
  level: number;
  current_streak: number;
  wallet_balance: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  task_type: string;
  base_reward: number;
}

export interface Task {
  id: string;
  project_id: string;
  source_data: {
    french: string;
  };
  difficulty_weight: number;
  status: TaskStatus;
  locked_until?: string;
  locked_by?: string;
}

export interface SubmissionMetadata {
  time_spent_ms: number;
  keystroke_count: number;
  paste_detected: boolean;
  tab_switches: number;
}

export interface Submission {
  id: string;
  task_id: string;
  user_id: string;
  content: {
    kirundi: string;
  };
  metadata: SubmissionMetadata;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submitted_at: string;
  source_data?: { french: string };
  submitter_name?: string;
}
