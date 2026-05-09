from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.api.fraud import evaluate_submission
from app.api.schemas import ClaimRequest, SubmissionCreate, SubmissionRead, TaskRead
from app.api.utils import client_ip, utc_now
from app.db.session import get_session
from app.models import Submission, Task, TaskStatus, User


router = APIRouter(prefix="/tasks", tags=["tasks"])


def serialize_task(task: Task) -> TaskRead:
    return TaskRead(
        id=task.id or 0,
        project_id=task.project_id,
        source_payload=task.source_payload,
        status=task.status,
        locked_until=task.locked_until.isoformat() if task.locked_until else None,
        storage_key=task.storage_key,
    )


@router.post("/claim", response_model=list[TaskRead])
def claim_tasks(
    payload: ClaimRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TaskRead]:
    now = utc_now()
    statement = (
        select(Task)
        .where(
            (Task.status == TaskStatus.AVAILABLE)
            | ((Task.status == TaskStatus.CLAIMED) & (Task.locked_until < now))
        )
        .order_by(Task.id)
        .limit(payload.count)
        .with_for_update(skip_locked=True)
    )
    tasks = session.exec(statement).all()
    for task in tasks:
        task.status = TaskStatus.CLAIMED
        task.locked_until = now + timedelta(minutes=30)
        session.add(task)
    session.commit()
    return [serialize_task(task) for task in tasks]


@router.post("/submit", response_model=SubmissionRead)
def submit_task(
    payload: SubmissionCreate,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> SubmissionRead:
    task = session.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status not in {TaskStatus.CLAIMED, TaskStatus.AVAILABLE}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task is not claimable")

    submission = Submission(
        task_id=task.id or 0,
        annotator_id=current_user.id or 0,
        result_payload={
            **payload.result_payload,
            "_client_metadata": {"tab_switches": payload.tab_switches},
        },
        keystroke_count=payload.keystroke_count,
        time_spent_ms=payload.time_spent_ms,
        ip_address=client_ip(request),
    )
    session.add(submission)
    session.flush()

    alerts = evaluate_submission(session, submission, current_user)
    task.status = TaskStatus.REJECTED if alerts else TaskStatus.PENDING_REVIEW
    session.add(task)
    session.add(current_user)
    session.commit()
    session.refresh(submission)
    session.refresh(task)

    return SubmissionRead(
        id=submission.id or 0,
        task=serialize_task(task),
        annotator_id=submission.annotator_id,
        result_payload=submission.result_payload,
        keystroke_count=submission.keystroke_count,
        time_spent_ms=submission.time_spent_ms,
    )
