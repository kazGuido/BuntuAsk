from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models import ReviewDecision, TaskStatus, TaskType, UserRole


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    email: str
    whatsapp_number: str
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    whatsapp_number: str
    role: UserRole
    wallet_balance: float
    is_active: bool
    trust_score: float


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ProjectCreate(BaseModel):
    name: str
    task_type: TaskType
    base_reward_annotator: float
    base_reward_reviewer: float
    required_reviews: int = 2
    min_accuracy_threshold: float = 0.8


class ProjectRead(BaseModel):
    id: int
    name: str
    task_type: TaskType
    base_reward_annotator: float
    base_reward_reviewer: float
    required_reviews: int = 2
    min_accuracy_threshold: float = 0.8


class ClaimRequest(BaseModel):
    count: int = Field(default=1, ge=1, le=20)


class TaskRead(BaseModel):
    id: int
    project_id: int
    source_payload: dict[str, Any]
    status: TaskStatus
    locked_until: str | None = None
    storage_key: str | None = None
    claimed_by_id: int | None = None


class SubmissionCreate(BaseModel):
    task_id: int
    result_payload: dict[str, Any] = Field(default_factory=dict)
    keystroke_count: int = 0
    time_spent_ms: int = 0
    tab_switches: int = 0


class SubmissionRead(BaseModel):
    id: int
    task: TaskRead
    annotator_id: int
    result_payload: dict[str, Any]
    keystroke_count: int
    time_spent_ms: int


class ReviewCreate(BaseModel):
    submission_id: int
    decision: ReviewDecision
    reason_code: str = ""


class StorageUrlRequest(BaseModel):
    key: str
    content_type: str = "application/octet-stream"
    expires_in: int = Field(default=3600, ge=60, le=86400)


class StorageUrlResponse(BaseModel):
    url: str
    key: str


class HfImportRequest(BaseModel):
    hf_repo: str
    subset: str | None = None
    split: str = "train"
    project_id: int
    row_limit: int = Field(default=5000, ge=1, le=30000)


class HfImportResponse(BaseModel):
    status: str
    job_id: int
    project_id: int
    row_limit: int


class ImportReviewResolveRequest(BaseModel):
    task_id: int
    approved: bool


class WithdrawalApproveRequest(BaseModel):
    transaction_id: int


class ConflictResolveRequest(BaseModel):
    task_id: int
    approved: bool


class WhatsAppSendRequest(BaseModel):
    phone: str
    message: str
