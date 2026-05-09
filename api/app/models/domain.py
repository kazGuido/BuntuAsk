from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import Column
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


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=160)
    task_type: TaskType
    base_reward_annotator: float
    base_reward_reviewer: float

    policy: "ProjectPolicy | None" = Relationship(back_populates="project")
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
    source_payload: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    status: TaskStatus = Field(default=TaskStatus.AVAILABLE, index=True)
    locked_until: datetime | None = Field(default=None, nullable=True, index=True)
    storage_key: str | None = Field(default=None, nullable=True, max_length=512)

    project: Project = Relationship(back_populates="tasks")
    submissions: list["Submission"] = Relationship(back_populates="task")


class Submission(SQLModel, table=True):
    __tablename__ = "submissions"

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

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    amount: float
    type: TransactionType
    status: TransactionStatus = Field(default=TransactionStatus.PENDING)

    user: User = Relationship(back_populates="transactions")


class FraudAlert(SQLModel, table=True):
    __tablename__ = "fraud_alerts"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    alert_type: FraudAlertType
    description: str
    resolved: bool = Field(default=False)

    user: User = Relationship(back_populates="fraud_alerts")
