import pytest
from pydantic import ValidationError

from app.api.admin import extract_prompt
from app.api.storage import authorize_storage_key
from app.models import Review, Submission, Task, TaskStatus, User, UserRole
from app.api.schemas import UserCreate


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
