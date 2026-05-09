from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import get_current_user
from app.api.fraud import evaluate_submission
from app.api.notifications import create_notification, notify_user_id
from app.api.schemas import ClaimRequest, SubmissionCreate, SubmissionRead, TaskRead
from app.api.utils import client_ip, utc_now
from app.db.session import get_session
from app.models import AuditAction, NotificationChannel, Submission, Task, TaskStatus, User, UserRole


router = APIRouter(prefix="/tasks", tags=["tasks"])


def serialize_task(task: Task) -> TaskRead:
    return TaskRead(
        id=task.id or 0,
        project_id=task.project_id,
        source_payload=task.source_payload,
        status=task.status,
        locked_until=task.locked_until.isoformat() if task.locked_until else None,
        storage_key=task.storage_key,
        claimed_by_id=task.claimed_by_id,
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
        task.claimed_by_id = current_user.id
        task.locked_until = now + timedelta(minutes=30)
        session.add(task)
        write_audit(
            session,
            action=AuditAction.TASK_CLAIMED,
            actor=current_user,
            target_user_id=current_user.id,
            entity_type="task",
            entity_id=task.id,
            description=f"Task {task.id} claimed by {current_user.username}.",
        )
    if tasks:
        create_notification(
            session,
            user=current_user,
            title="Task batch claimed",
            body=f"You claimed {len(tasks)} task{'s' if len(tasks) != 1 else ''}. Submit before the 30 minute lock expires.",
            channels=[NotificationChannel.IN_APP],
            category="TASK",
            metadata={"task_ids": [task.id for task in tasks]},
        )
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
    now = utc_now()
    if task.status != TaskStatus.CLAIMED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task must be claimed before submission")
    if task.claimed_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Task is claimed by another user")
    if task.locked_until is not None and task.locked_until < now:
        task.status = TaskStatus.AVAILABLE
        task.claimed_by_id = None
        task.locked_until = None
        session.add(task)
        session.commit()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task claim expired")

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
    task.status = TaskStatus.PENDING_REVIEW
    task.locked_until = None
    session.add(task)
    session.add(current_user)
    write_audit(
        session,
        action=AuditAction.TASK_SUBMITTED,
        actor=current_user,
        target_user_id=current_user.id,
        entity_type="submission",
        entity_id=submission.id,
        description=f"Submission {submission.id} created for task {task.id}.",
        metadata={"fraud_alerts": [alert.alert_type.value for alert in alerts]},
        ip_address=submission.ip_address,
    )
    create_notification(
        session,
        user=current_user,
        title="Submission received",
        body=f"Task {task.id} is now pending review. You will be notified when reviewers reach a decision.",
        channels=[NotificationChannel.IN_APP],
        category="TASK",
        metadata={"task_id": task.id, "submission_id": submission.id},
    )
    if alerts:
        create_notification(
            session,
            user=current_user,
            title="Quality check warning",
            body="Your submission triggered automated quality checks. It is still queued for review, but repeated flags can lower trust.",
            channels=[NotificationChannel.IN_APP],
            category="FRAUD",
            metadata={"task_id": task.id, "submission_id": submission.id, "alert_types": [alert.alert_type.value for alert in alerts]},
        )
    reviewers = session.exec(
        select(User).where(User.role.in_([UserRole.REVIEWER, UserRole.ADMIN]), User.is_active == True)  # noqa: E712
    ).all()
    for reviewer in reviewers:
        if reviewer.id != current_user.id:
            notify_user_id(
                session,
                user_id=reviewer.id or 0,
                title="New submission ready for review",
                body=f"Submission {submission.id} for task {task.id} is waiting in the review queue.",
                channels=[NotificationChannel.IN_APP],
                category="REVIEW",
                metadata={"task_id": task.id, "submission_id": submission.id},
            )
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
