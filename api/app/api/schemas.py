from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import (
    NotificationChannel,
    NotificationDeliveryStatus,
    ProjectStatus,
    ProjectWorkflow,
    ReviewDecision,
    TaskStatus,
    TaskType,
    UserRole,
)


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
    description: str = Field(default="", max_length=1000)
    language: str = Field(default="", max_length=80)
    guidelines: str = ""
    sample_payload: dict[str, Any] = Field(default_factory=dict)
    task_type: TaskType
    workflow: ProjectWorkflow = ProjectWorkflow.TRANSLATION
    base_reward_annotator: float
    base_reward_reviewer: float
    required_reviews: int = 2
    min_accuracy_threshold: float = 0.8

    @model_validator(mode="after")
    def validate_workflow_media(self) -> "ProjectCreate":
        if self.workflow in {ProjectWorkflow.AUDIO_TRANSCRIPTION, ProjectWorkflow.VOICE_RECORDING} and self.task_type != TaskType.AUDIO:
            raise ValueError("Audio workflows require task_type=AUDIO")
        if self.workflow == ProjectWorkflow.IMAGE_LABELING and self.task_type != TaskType.IMAGE:
            raise ValueError("Image labeling requires task_type=IMAGE")
        if self.workflow == ProjectWorkflow.TRANSLATION and self.task_type != TaskType.TEXT:
            raise ValueError("Translation requires task_type=TEXT")
        return self


class ProjectRead(BaseModel):
    id: int
    owner_id: int | None = None
    approved_by_id: int | None = None
    name: str
    description: str = ""
    language: str = ""
    guidelines: str = ""
    sample_payload: dict[str, Any] = Field(default_factory=dict)
    task_type: TaskType
    workflow: ProjectWorkflow
    status: ProjectStatus
    base_reward_annotator: float
    base_reward_reviewer: float
    required_reviews: int = 2
    min_accuracy_threshold: float = 0.8


class ProjectApprovalRequest(BaseModel):
    project_id: int
    approved: bool
    reason: str = ""


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
    total_audio_played_ms: int = 0
    unique_audio_coverage_ms: int = 0


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


class NotificationSendRequest(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    body: str = Field(min_length=1, max_length=5000)
    channels: list[NotificationChannel] = Field(default_factory=lambda: [NotificationChannel.IN_APP])
    category: str = Field(default="GENERAL", max_length=80)
    metadata: dict[str, Any] = Field(default_factory=dict)


class NotificationDeliveryRead(BaseModel):
    id: int
    channel: NotificationChannel
    status: NotificationDeliveryStatus
    destination: str | None = None
    error_message: str | None = None


class NotificationRead(BaseModel):
    id: int
    title: str
    body: str
    category: str
    metadata: dict[str, Any]
    is_read: bool
    created_at: str
    read_at: str | None = None
    deliveries: list[NotificationDeliveryRead] = Field(default_factory=list)
