from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.deps import require_reviewer
from app.api.fraud import evaluate_review
from app.api.policy import evaluate_consensus
from app.api.schemas import ReviewCreate, SubmissionRead
from app.api.tasks import serialize_task
from app.api.utils import client_ip
from app.db.session import get_session
from app.models import Review, Submission, Task, TaskStatus, User


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
    session.commit()
    return {"status": new_status.value}
