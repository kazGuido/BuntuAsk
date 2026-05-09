import pytest
from pathlib import Path
from pydantic import ValidationError

from app.api.admin import extract_prompt
from app.api.notifications import build_email_message
from app.api.storage import authorize_storage_key
from app.models import Notification, NotificationChannel, NotificationDelivery, Review, Submission, Task, TaskStatus, User, UserRole
from app.api.schemas import NotificationSendRequest, UserCreate


def test_public_registration_cannot_request_admin_role() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            username="mallory",
            email="mallory@example.com",
            whatsapp_number="+15550000000",
            password="strong-password",
            role="ADMIN",
        )


def test_storage_keys_are_scoped_for_non_admin_users() -> None:
    user = User(
        id=7,
        username="annotator",
        email="annotator@example.com",
        whatsapp_number="+15550000001",
        password_hash="x",
        role=UserRole.ANNOTATOR,
    )

    assert authorize_storage_key(user, "users/7/audio.wav") == "users/7/audio.wav"
    with pytest.raises(Exception):
        authorize_storage_key(user, "users/8/audio.wav")


def test_admin_storage_keys_are_not_forced_into_user_prefix() -> None:
    admin = User(
        id=1,
        username="admin",
        email="admin@example.com",
        whatsapp_number="+15550000002",
        password_hash="x",
        role=UserRole.ADMIN,
    )

    assert authorize_storage_key(admin, "/projects/1/source.wav") == "projects/1/source.wav"


def test_hf_prompt_extraction_skips_unusable_rows() -> None:
    assert extract_prompt({"messages": [{"role": "user", "content": "Bonjour"}]}) == "Bonjour"
    assert extract_prompt({"not_prompt": {"nested": "value"}}) == ""


def test_schema_contains_ownership_and_uniqueness_guards() -> None:
    assert TaskStatus.IMPORT_REVIEW.value == "IMPORT_REVIEW"
    assert "claimed_by_id" in Task.model_fields
    assert any(constraint.name == "uq_submissions_task_id" for constraint in Submission.__table__.constraints)
    assert any(constraint.name == "uq_reviews_submission_reviewer" for constraint in Review.__table__.constraints)


def test_notification_schema_and_email_message_builder() -> None:
    payload = NotificationSendRequest(
        user_ids=[1],
        title="Task approved",
        body="You earned a reward.",
        channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    )
    assert payload.channels == [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
    assert "metadata_json" in Notification.model_fields
    assert "channel" in NotificationDelivery.model_fields

    message = build_email_message(
        to_email="user@example.com",
        subject=payload.title,
        body=payload.body,
        from_email="noreply@example.com",
    )
    assert message["To"] == "user@example.com"
    assert message["Subject"] == "Task approved"
    assert "You earned a reward." in message.get_content()


def test_typical_event_workflows_emit_notifications() -> None:
    api_dir = Path("api/app/api")
    expected_hooks = {
        "auth.py": "Welcome to BuntuAsk",
        "tasks.py": "Submission received",
        "reviews.py": "Review recorded",
        "fraud.py": "Fraud alert needs review",
        "admin.py": "Withdrawal approved",
    }
    for filename, marker in expected_hooks.items():
        assert marker in (api_dir / filename).read_text()
