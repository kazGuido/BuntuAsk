from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    ANNOTATOR = "ANNOTATOR"
    REVIEWER = "REVIEWER"


class TaskType(str, Enum):
    TEXT = "TEXT"
    AUDIO = "AUDIO"
    IMAGE = "IMAGE"


class TaskStatus(str, Enum):
    IMPORT_REVIEW = "IMPORT_REVIEW"
    AVAILABLE = "AVAILABLE"
    CLAIMED = "CLAIMED"
    PENDING_REVIEW = "PENDING_REVIEW"
    CONFLICT = "CONFLICT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ReviewDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class TransactionType(str, Enum):
    EARNING = "EARNING"
    WITHDRAWAL = "WITHDRAWAL"


class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class FraudAlertType(str, Enum):
    COLLUSION = "COLLUSION"
    BOT_BEHAVIOR = "BOT_BEHAVIOR"
    SPEED_HACK = "SPEED_HACK"


class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"


class NotificationDeliveryStatus(str, Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class ImportJobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AuditAction(str, Enum):
    USER_REGISTERED = "USER_REGISTERED"
    USER_LOGIN = "USER_LOGIN"
    TASK_CLAIMED = "TASK_CLAIMED"
    TASK_SUBMITTED = "TASK_SUBMITTED"
    REVIEW_CREATED = "REVIEW_CREATED"
    PROJECT_CREATED = "PROJECT_CREATED"
    HF_IMPORT_QUEUED = "HF_IMPORT_QUEUED"
    HF_IMPORT_COMPLETED = "HF_IMPORT_COMPLETED"
    HF_TASK_APPROVED = "HF_TASK_APPROVED"
    HF_TASK_REJECTED = "HF_TASK_REJECTED"
    FRAUD_ALERT_RESOLVED = "FRAUD_ALERT_RESOLVED"
    USER_BANNED = "USER_BANNED"
    CONFLICT_RESOLVED = "CONFLICT_RESOLVED"
    WITHDRAWAL_APPROVED = "WITHDRAWAL_APPROVED"
    NOTIFICATION_SENT = "NOTIFICATION_SENT"
    NOTIFICATION_READ = "NOTIFICATION_READ"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True, max_length=80)
    email: str = Field(index=True, unique=True, max_length=255)
    whatsapp_number: str = Field(index=True, max_length=32)
    password_hash: str = Field(max_length=255)
    role: UserRole = Field(default=UserRole.ANNOTATOR)
    wallet_balance: float = Field(default=0.0)
    is_active: bool = Field(default=True)
    trust_score: float = Field(default=100.0)

    submissions: list["Submission"] = Relationship(back_populates="annotator")
    reviews: list["Review"] = Relationship(back_populates="reviewer")
    transactions: list["Transaction"] = Relationship(back_populates="user")
    fraud_alerts: list["FraudAlert"] = Relationship(back_populates="user")
    claimed_tasks: list["Task"] = Relationship(back_populates="claimed_by")
    notifications: list["Notification"] = Relationship(back_populates="user")


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=160)
    task_type: TaskType
    base_reward_annotator: float
    base_reward_reviewer: float

    policy: Optional["ProjectPolicy"] = Relationship(back_populates="project")
    tasks: list["Task"] = Relationship(back_populates="project")


class ProjectPolicy(SQLModel, table=True):
    __tablename__ = "project_policies"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True, unique=True)
    required_reviews: int = Field(default=2)
    min_accuracy_threshold: float

    project: Project = Relationship(back_populates="policy")


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    claimed_by_id: int | None = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    source_payload: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    status: TaskStatus = Field(default=TaskStatus.AVAILABLE, index=True)
    locked_until: datetime | None = Field(default=None, nullable=True, index=True)
    storage_key: str | None = Field(default=None, nullable=True, max_length=512)

    project: Project = Relationship(back_populates="tasks")
    claimed_by: User | None = Relationship(back_populates="claimed_tasks")
    submissions: list["Submission"] = Relationship(back_populates="task")


class Submission(SQLModel, table=True):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("task_id", name="uq_submissions_task_id"),)

    id: int | None = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="tasks.id", index=True)
    annotator_id: int = Field(foreign_key="users.id", index=True)
    result_payload: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    keystroke_count: int
    time_spent_ms: int
    ip_address: str = Field(max_length=64)

    task: Task = Relationship(back_populates="submissions")
    annotator: User = Relationship(back_populates="submissions")
    reviews: list["Review"] = Relationship(back_populates="submission")


class Review(SQLModel, table=True):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("submission_id", "reviewer_id", name="uq_reviews_submission_reviewer"),)

    id: int | None = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submissions.id", index=True)
    reviewer_id: int = Field(foreign_key="users.id", index=True)
    decision: ReviewDecision
    reason_code: str = Field(max_length=120)
    ip_address: str = Field(max_length=64)

    submission: Submission = Relationship(back_populates="reviews")
    reviewer: User = Relationship(back_populates="reviews")


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_transactions_idempotency_key"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    amount: float
    type: TransactionType
    status: TransactionStatus = Field(default=TransactionStatus.PENDING)
    reference_type: str | None = Field(default=None, nullable=True, max_length=80)
    reference_id: int | None = Field(default=None, nullable=True, index=True)
    idempotency_key: str = Field(max_length=160)

    user: User = Relationship(back_populates="transactions")


class FraudAlert(SQLModel, table=True):
    __tablename__ = "fraud_alerts"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    alert_type: FraudAlertType
    description: str
    resolved: bool = Field(default=False)

    user: User = Relationship(back_populates="fraud_alerts")


class ImportJob(SQLModel, table=True):
    __tablename__ = "import_jobs"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    requested_by_id: int = Field(foreign_key="users.id", index=True)
    hf_repo: str = Field(max_length=255)
    subset: str | None = Field(default=None, nullable=True, max_length=120)
    split: str = Field(default="train", max_length=120)
    row_limit: int
    status: ImportJobStatus = Field(default=ImportJobStatus.QUEUED, index=True)
    imported_count: int = Field(default=0)
    skipped_count: int = Field(default=0)
    error_message: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    completed_at: datetime | None = Field(default=None, nullable=True)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: int | None = Field(default=None, primary_key=True)
    actor_id: int | None = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    target_user_id: int | None = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    action: AuditAction = Field(index=True)
    entity_type: str = Field(max_length=80)
    entity_id: int | None = Field(default=None, nullable=True, index=True)
    description: str
    metadata_json: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False),
    )
    ip_address: str | None = Field(default=None, nullable=True, max_length=64)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(max_length=180)
    body: str
    category: str = Field(default="GENERAL", max_length=80, index=True)
    metadata_json: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False),
    )
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    read_at: datetime | None = Field(default=None, nullable=True)

    user: User = Relationship(back_populates="notifications")
    deliveries: list["NotificationDelivery"] = Relationship(back_populates="notification")


class NotificationDelivery(SQLModel, table=True):
    __tablename__ = "notification_deliveries"

    id: int | None = Field(default=None, primary_key=True)
    notification_id: int = Field(foreign_key="notifications.id", index=True)
    channel: NotificationChannel = Field(index=True)
    status: NotificationDeliveryStatus = Field(default=NotificationDeliveryStatus.QUEUED, index=True)
    destination: str | None = Field(default=None, nullable=True, max_length=255)
    provider_message_id: str | None = Field(default=None, nullable=True, max_length=255)
    error_message: str | None = Field(default=None, nullable=True)
    attempted_at: datetime | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    notification: Notification = Relationship(back_populates="deliveries")
