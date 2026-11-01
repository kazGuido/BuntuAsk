from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import get_current_user
from app.api.fraud import evaluate_submission
from app.api.notifications import create_notification, notify_user_id
from app.api.schemas import ClaimRequest, SubmissionCreate, SubmissionRead, TaskRead, WorkSummaryRead
from app.api.utils import client_ip, record_task_completion, utc_now
from app.db.session import get_session
from app.models import (
    AuditAction,
    NotificationChannel,
    Project,
    ProjectStatus,
    ProjectWorkflow,
    Submission,
    Task,
    TaskStatus,
    User,
    UserRole,
)


router = APIRouter(prefix="/tasks", tags=["tasks"])


def _source_language(payload: dict) -> str:
    for key in ("source_language", "source_lang", "from_language", "language_from"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if isinstance(payload.get("french"), str):
        return "French"
    if isinstance(payload.get("english"), str):
        return "English"
    return "English"


def serialize_task(task: Task, session: Session | None = None) -> TaskRead:
    source_payload = dict(task.source_payload)
    project = session.get(Project, task.project_id) if session is not None else None
    if project is not None:
        if "project_workflow" not in source_payload:
            source_payload["project_workflow"] = project.workflow.value
            source_payload["project_status"] = project.status.value
        workflow = project.workflow
        project_language = project.language or "Kirundi"
        reward = project.base_reward_annotator
    else:
        workflow_value = source_payload.get("project_workflow")
        workflow = ProjectWorkflow(workflow_value) if workflow_value else None
        project_language = str(source_payload.get("project_language") or "Kirundi")
        reward = float(source_payload.get("reward_usd") or 0)

    return TaskRead(
        id=task.id or 0,
        project_id=task.project_id,
        source_payload=source_payload,
        status=task.status,
        locked_until=task.locked_until.isoformat() if task.locked_until else None,
        storage_key=task.storage_key,
        claimed_by_id=task.claimed_by_id,
        project_workflow=workflow,
        project_language=project_language,
        source_language=_source_language(source_payload),
        reward_usd=reward,
    )


@router.get("/work-summary", response_model=WorkSummaryRead)
def work_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> WorkSummaryRead:
    pending = session.exec(
        select(Submission)
        .join(Task, Submission.task_id == Task.id)
        .where(
            Submission.annotator_id == current_user.id,
            Task.status == TaskStatus.PENDING_REVIEW,
        )
    ).all()
    accepted = session.exec(
        select(Submission)
        .join(Task, Submission.task_id == Task.id)
        .where(
            Submission.annotator_id == current_user.id,
            Task.status == TaskStatus.APPROVED,
        )
    ).all()
    return WorkSummaryRead(
        pending_review=len(pending),
        accepted=len(accepted),
        earned_usd=current_user.wallet_balance,
    )


@router.get("/active-batch", response_model=list[TaskRead])
def active_batch(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TaskRead]:
    now = utc_now()
    tasks = session.exec(
        select(Task)
        .where(
            Task.claimed_by_id == current_user.id,
            Task.status == TaskStatus.CLAIMED,
            Task.locked_until.is_not(None),
            Task.locked_until >= now,
        )
        .order_by(Task.id)
    ).all()
    return [serialize_task(task, session) for task in tasks]


@router.post("/release-batch")
def release_batch(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, int]:
    now = utc_now()
    tasks = session.exec(
        select(Task).where(
            Task.claimed_by_id == current_user.id,
            Task.status == TaskStatus.CLAIMED,
        )
    ).all()
    released = 0
    for task in tasks:
        task.status = TaskStatus.AVAILABLE
        task.claimed_by_id = None
        task.locked_until = None
        session.add(task)
        released += 1
        write_audit(
            session,
            action=AuditAction.TASK_CLAIMED,
            actor=current_user,
            target_user_id=current_user.id,
            entity_type="task",
            entity_id=task.id,
            description=f"Task {task.id} released by {current_user.username} at {now.isoformat()}.",
        )
    session.commit()
    return {"released": released}


@router.post("/claim", response_model=list[TaskRead])
def claim_tasks(
    payload: ClaimRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TaskRead]:
    now = utc_now()
    filters = [
        Project.status == ProjectStatus.ACTIVE,
        (Task.status == TaskStatus.AVAILABLE)
        | ((Task.status == TaskStatus.CLAIMED) & (Task.locked_until < now)),
    ]
    if payload.workflow is not None:
        filters.append(Project.workflow == payload.workflow)
    statement = (
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(*filters)
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
    return [serialize_task(task, session) for task in tasks]


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

    project = session.get(Project, task.project_id)
    if project is None or project.status != ProjectStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is not active")
    result_payload = dict(payload.result_payload)
    if project.workflow == ProjectWorkflow.AUDIO_TRANSCRIPTION:
        duration_ms = int(task.source_payload.get("duration_ms") or 0)
        listened_ms = max(payload.total_audio_played_ms, payload.unique_audio_coverage_ms)
        if duration_ms > 0 and listened_ms < duration_ms:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must listen to the entire clip before submitting.")
        transcript = str(result_payload.get("transcript") or result_payload.get("text") or "").strip()
        if not transcript:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transcript is required")
        result_payload.update(
            {
                "transcript": transcript,
                "total_audio_played_ms": payload.total_audio_played_ms,
                "unique_audio_coverage_ms": payload.unique_audio_coverage_ms,
            }
        )
    elif project.workflow == ProjectWorkflow.VOICE_RECORDING:
        recording_key = str(result_payload.get("recording_key") or "").strip()
        mime_type = str(result_payload.get("mime_type") or "").strip()
        if not recording_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recording key is required")
        if mime_type not in {"audio/webm", "audio/wav", "audio/ogg", "audio/mpeg", "audio/mp4"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported recording MIME type")

    submission = Submission(
        task_id=task.id or 0,
        annotator_id=current_user.id or 0,
        result_payload={
            **result_payload,
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
    record_task_completion(current_user, now)
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
    session.add(current_user)
    session.commit()
    session.refresh(submission)
    session.refresh(task)

    return SubmissionRead(
        id=submission.id or 0,
        task=serialize_task(task, session),
        annotator_id=submission.annotator_id,
        result_payload=submission.result_payload,
        keystroke_count=submission.keystroke_count,
        time_spent_ms=submission.time_spent_ms,
    )
