from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import require_reviewer
from app.api.fraud import evaluate_review
from app.api.notifications import create_notification, notify_user_id
from app.api.policy import evaluate_consensus
from app.api.schemas import ReviewCreate, SubmissionRead
from app.api.tasks import serialize_task
from app.api.utils import client_ip
from app.db.session import get_session
from app.models import AuditAction, NotificationChannel, Review, Submission, Task, TaskStatus, User


router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/queue", response_model=list[SubmissionRead])
def review_queue(
    current_user: Annotated[User, Depends(require_reviewer)],
    session: Annotated[Session, Depends(get_session)],
) -> list[SubmissionRead]:
    statement = (
        select(Submission, Task)
        .join(Task, Submission.task_id == Task.id)
        .where(Task.status == TaskStatus.PENDING_REVIEW, Submission.annotator_id != (current_user.id or 0))
        .order_by(Submission.id)
        .limit(25)
    )
    rows = session.exec(statement).all()
    return [
        SubmissionRead(
            id=submission.id or 0,
            task=serialize_task(task),
            annotator_id=submission.annotator_id,
            result_payload=submission.result_payload,
            keystroke_count=submission.keystroke_count,
            time_spent_ms=submission.time_spent_ms,
        )
        for submission, task in rows
    ]


@router.post("")
def create_review(
    payload: ReviewCreate,
    request: Request,
    current_user: Annotated[User, Depends(require_reviewer)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    submission = session.get(Submission, payload.submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    existing = session.exec(
        select(Review).where(
            Review.submission_id == payload.submission_id,
            Review.reviewer_id == (current_user.id or 0),
        )
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already reviewed this submission")

    review = Review(
        submission_id=payload.submission_id,
        reviewer_id=current_user.id or 0,
        decision=payload.decision,
        reason_code=payload.reason_code or payload.decision.value,
        ip_address=client_ip(request),
    )
    try:
        evaluate_review(session, submission, review)
    except ValueError as exc:
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    session.add(review)
    session.flush()
    new_status = evaluate_consensus(session, submission)
    write_audit(
        session,
        action=AuditAction.REVIEW_CREATED,
        actor=current_user,
        target_user_id=submission.annotator_id,
        entity_type="review",
        entity_id=review.id,
        description=f"Review {review.id} {payload.decision.value} for submission {submission.id}.",
        metadata={"submission_id": submission.id, "task_id": submission.task_id, "new_status": new_status.value},
        ip_address=review.ip_address,
    )
    create_notification(
        session,
        user=current_user,
        title="Review recorded",
        body=f"Your {payload.decision.value.lower()} review for submission {submission.id} was recorded.",
        channels=[NotificationChannel.IN_APP],
        category="REVIEW",
        metadata={"submission_id": submission.id, "task_id": submission.task_id, "new_status": new_status.value},
    )
    if new_status == TaskStatus.CONFLICT:
        notify_user_id(
            session,
            user_id=submission.annotator_id,
            title="Submission escalated",
            body=f"Task {submission.task_id} received conflicting reviews and is now in the admin conflict queue.",
            channels=[NotificationChannel.IN_APP],
            category="REVIEW",
            metadata={"submission_id": submission.id, "task_id": submission.task_id},
        )
    elif new_status == TaskStatus.REJECTED:
        notify_user_id(
            session,
            user_id=submission.annotator_id,
            title="Submission rejected",
            body=f"Task {submission.task_id} was rejected after review.",
            channels=[NotificationChannel.IN_APP],
            category="REVIEW",
            metadata={"submission_id": submission.id, "task_id": submission.task_id},
        )
    elif new_status == TaskStatus.PENDING_REVIEW:
        notify_user_id(
            session,
            user_id=submission.annotator_id,
            title="Review received",
            body=f"Task {submission.task_id} received a review and is waiting for the remaining consensus checks.",
            channels=[NotificationChannel.IN_APP],
            category="REVIEW",
            metadata={"submission_id": submission.id, "task_id": submission.task_id},
        )
    session.commit()
    return {"status": new_status.value}
