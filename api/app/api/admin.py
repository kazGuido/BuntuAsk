import logging
from datetime import datetime
from typing import Annotated, Any

from datasets import load_dataset
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import require_admin
from app.api.notifications import create_notification, notify_user_id
from app.api.policy import distribute_approval_rewards
from app.api.schemas import (
    ConflictResolveRequest,
    HfImportRequest,
    HfImportResponse,
    ImportReviewResolveRequest,
    ProjectApprovalRequest,
    ProjectCreate,
    ProjectRead,
    WithdrawalApproveRequest,
)
from app.api.tasks import serialize_task
from app.db.session import engine, get_session
from app.models import (
    AuditAction,
    AuditLog,
    FraudAlert,
    ImportJob,
    ImportJobStatus,
    NotificationChannel,
    Project,
    ProjectPolicy,
    ProjectStatus,
    ProjectWorkflow,
    Review,
    ReviewDecision,
    Submission,
    Task,
    TaskStatus,
    Transaction,
    TransactionStatus,
    User,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def serialize_project(project: Project, policy: ProjectPolicy | None) -> ProjectRead:
    return ProjectRead(
        id=project.id or 0,
        owner_id=project.owner_id,
        approved_by_id=project.approved_by_id,
        name=project.name,
        task_type=project.task_type,
        workflow=project.workflow,
        status=project.status,
        base_reward_annotator=project.base_reward_annotator,
        base_reward_reviewer=project.base_reward_reviewer,
        required_reviews=policy.required_reviews if policy else 2,
        min_accuracy_threshold=policy.min_accuracy_threshold if policy else 0.8,
    )


def _text_from_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                value = item.get("text") or item.get("content")
                if isinstance(value, str):
                    parts.append(value)
        return "\n".join(parts)
    if isinstance(content, dict):
        value = content.get("text") or content.get("content")
        return value if isinstance(value, str) else ""
    return ""


def extract_prompt(row: dict[str, Any]) -> str:
    messages = row.get("messages") or row.get("conversation") or row.get("conversations")
    if isinstance(messages, list):
        user_messages = []
        fallback_messages = []
        for message in messages:
            if isinstance(message, dict):
                text = _text_from_message_content(message.get("content") or message.get("value"))
                if text:
                    fallback_messages.append(text)
                role = str(message.get("role") or message.get("from") or "").lower()
                if role in {"user", "human", "prompt"} and text:
                    user_messages.append(text)
        return "\n\n".join(user_messages or fallback_messages)

    for key in ("prompt", "instruction", "input", "question", "text", "french", "source"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return ""


def import_hf_dataset(job_id: int) -> None:
    imported = 0
    skipped = 0
    with Session(engine) as session:
        job = session.get(ImportJob, job_id)
        if job is None:
            logger.error("HF import aborted: job %s not found", job_id)
            return
        job.status = ImportJobStatus.RUNNING
        session.add(job)
        session.commit()

        project = session.get(Project, job.project_id)
        if project is None:
            job.status = ImportJobStatus.FAILED
            job.error_message = f"Project {job.project_id} not found"
            job.completed_at = datetime.utcnow()
            notify_user_id(
                session,
                user_id=job.requested_by_id,
                title="Hugging Face import failed",
                body=job.error_message,
                channels=[NotificationChannel.IN_APP],
                category="IMPORT",
                metadata={"import_job_id": job.id, "project_id": job.project_id},
            )
            session.add(job)
            session.commit()
            return

        try:
            dataset = load_dataset(
                job.hf_repo,
                job.subset or None,
                split=job.split,
                streaming=True,
            )
            for row in dataset:
                prompt = extract_prompt(dict(row))
                if not prompt or len(prompt) > 20000:
                    skipped += 1
                else:
                    task = Task(
                        project_id=job.project_id,
                        source_payload={
                            "prompt": prompt,
                            "hf_repo": job.hf_repo,
                            "subset": job.subset,
                            "split": job.split,
                            "import_job_id": job.id,
                        },
                        status=TaskStatus.IMPORT_REVIEW,
                    )
                    session.add(task)
                    imported += 1
                if (imported + skipped) % 500 == 0:
                    job.imported_count = imported
                    job.skipped_count = skipped
                    session.add(job)
                    session.commit()
                if imported + skipped >= job.row_limit:
                    break
            job.status = ImportJobStatus.COMPLETED
            job.imported_count = imported
            job.skipped_count = skipped
            job.completed_at = datetime.utcnow()
            write_audit(
                session,
                action=AuditAction.HF_IMPORT_COMPLETED,
                actor_id=job.requested_by_id,
                entity_type="import_job",
                entity_id=job.id,
                description=f"HF import job {job.id} completed with {imported} imported and {skipped} skipped rows.",
                metadata={"project_id": job.project_id, "hf_repo": job.hf_repo},
            )
            notify_user_id(
                session,
                user_id=job.requested_by_id,
                title="Hugging Face import completed",
                body=f"Import job {job.id} finished with {imported} rows ready for admin review and {skipped} skipped rows.",
                channels=[NotificationChannel.IN_APP],
                category="IMPORT",
                metadata={"import_job_id": job.id, "project_id": job.project_id, "imported_count": imported, "skipped_count": skipped},
            )
            session.add(job)
            session.commit()
            logger.info("HF import completed for project %s: %s rows", job.project_id, imported)
        except Exception as exc:  # pragma: no cover - exercised with live HF failures
            job.status = ImportJobStatus.FAILED
            job.error_message = str(exc)
            job.imported_count = imported
            job.skipped_count = skipped
            job.completed_at = datetime.utcnow()
            notify_user_id(
                session,
                user_id=job.requested_by_id,
                title="Hugging Face import failed",
                body=f"Import job {job.id} failed: {exc}",
                channels=[NotificationChannel.IN_APP],
                category="IMPORT",
                metadata={"import_job_id": job.id, "project_id": job.project_id},
            )
            session.add(job)
            session.commit()
            logger.exception("HF import job %s failed", job_id)


@router.get("/projects", response_model=list[ProjectRead])
def list_projects(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ProjectRead]:
    projects = session.exec(select(Project).order_by(Project.id)).all()
    result = []
    for project in projects:
        policy = session.exec(select(ProjectPolicy).where(ProjectPolicy.project_id == project.id)).first()
        result.append(serialize_project(project, policy))
    return result


@router.post("/projects", response_model=ProjectRead)
def create_project(
    payload: ProjectCreate,
    request: Request,
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> ProjectRead:
    project = Project(
        owner_id=_admin.id,
        approved_by_id=_admin.id,
        name=payload.name,
        task_type=payload.task_type,
        workflow=payload.workflow,
        status=ProjectStatus.ACTIVE,
        base_reward_annotator=payload.base_reward_annotator,
        base_reward_reviewer=payload.base_reward_reviewer,
    )
    session.add(project)
    session.flush()
    policy = ProjectPolicy(
        project_id=project.id or 0,
        required_reviews=payload.required_reviews,
        min_accuracy_threshold=payload.min_accuracy_threshold,
    )
    session.add(policy)
    write_audit(
        session,
        action=AuditAction.PROJECT_CREATED,
        actor=_admin,
        entity_type="project",
        entity_id=project.id,
        description=f"Project {project.name} created.",
        metadata=payload.model_dump(),
        ip_address=request.client.host if request.client else None,
    )
    session.commit()
    session.refresh(project)
    session.refresh(policy)
    return serialize_project(project, policy)


@router.post("/import-hf", response_model=HfImportResponse, status_code=status.HTTP_202_ACCEPTED)
def import_hf(
    payload: HfImportRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> HfImportResponse:
    if session.get(Project, payload.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    job = ImportJob(
        project_id=payload.project_id,
        requested_by_id=admin_user.id or 0,
        hf_repo=payload.hf_repo,
        subset=payload.subset or None,
        split=payload.split,
        row_limit=payload.row_limit,
        status=ImportJobStatus.QUEUED,
    )
    session.add(job)
    session.flush()
    write_audit(
        session,
        action=AuditAction.HF_IMPORT_QUEUED,
        actor=admin_user,
        entity_type="import_job",
        entity_id=job.id,
        description=f"Queued HF import {payload.hf_repo} for project {payload.project_id}.",
        metadata=payload.model_dump(),
        ip_address=request.client.host if request.client else None,
    )
    create_notification(
        session,
        user=admin_user,
        title="Hugging Face import queued",
        body=f"Import job {job.id} for {payload.hf_repo} is queued. Imported rows will require admin review before users can claim them.",
        channels=[NotificationChannel.IN_APP],
        category="IMPORT",
        metadata={"import_job_id": job.id, "project_id": payload.project_id},
    )
    session.commit()
    background_tasks.add_task(import_hf_dataset, job.id)
    return HfImportResponse(status=job.status.value, job_id=job.id or 0, project_id=payload.project_id, row_limit=payload.row_limit)


@router.get("/import-jobs")
def import_jobs(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    jobs = session.exec(select(ImportJob).order_by(ImportJob.id.desc()).limit(100)).all()
    return [job.model_dump() for job in jobs]


@router.get("/import-review-tasks")
def import_review_tasks(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    tasks = session.exec(
        select(Task).where(Task.status == TaskStatus.IMPORT_REVIEW).order_by(Task.id).limit(100)
    ).all()
    return [serialize_task(task, session).model_dump() for task in tasks]


@router.post("/import-review/resolve")
def resolve_import_review_task(
    payload: ImportReviewResolveRequest,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    task = session.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != TaskStatus.IMPORT_REVIEW:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task is not waiting for import review")

    task.status = TaskStatus.AVAILABLE if payload.approved else TaskStatus.REJECTED
    session.add(task)
    write_audit(
        session,
        action=AuditAction.HF_TASK_APPROVED if payload.approved else AuditAction.HF_TASK_REJECTED,
        actor=admin_user,
        entity_type="task",
        entity_id=task.id,
        description=f"Imported task {task.id} {'approved' if payload.approved else 'rejected'} for production queue.",
        metadata={"project_id": task.project_id},
        ip_address=request.client.host if request.client else None,
    )
    create_notification(
        session,
        user=admin_user,
        title="Imported task reviewed",
        body=f"Imported task {task.id} was {'approved for the live queue' if payload.approved else 'rejected'}.",
        channels=[NotificationChannel.IN_APP],
        category="IMPORT",
        metadata={"task_id": task.id, "project_id": task.project_id, "approved": payload.approved},
    )
    session.commit()
    return {"status": task.status.value}


@router.get("/fraud-alerts")
def fraud_alerts(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    alerts = session.exec(select(FraudAlert).order_by(FraudAlert.id.desc()).limit(100)).all()
    return [alert.model_dump() for alert in alerts]


@router.post("/fraud-alerts/{alert_id}/resolve")
def resolve_fraud_alert(
    alert_id: int,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    alert = session.get(FraudAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.resolved = True
    session.add(alert)
    write_audit(
        session,
        action=AuditAction.FRAUD_ALERT_RESOLVED,
        actor=admin_user,
        target_user_id=alert.user_id,
        entity_type="fraud_alert",
        entity_id=alert.id,
        description=f"Fraud alert {alert.id} resolved.",
        ip_address=request.client.host if request.client else None,
    )
    notify_user_id(
        session,
        user_id=alert.user_id,
        title="Fraud alert resolved",
        body=f"Fraud alert {alert.id} has been marked resolved by the admin team.",
        channels=[NotificationChannel.IN_APP],
        category="FRAUD",
        metadata={"alert_id": alert.id, "alert_type": alert.alert_type.value},
    )
    session.commit()
    return {"status": "resolved"}


@router.post("/users/{user_id}/ban")
def ban_user(
    user_id: int,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    session.add(user)
    write_audit(
        session,
        action=AuditAction.USER_BANNED,
        actor=admin_user,
        target_user_id=user.id,
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.username} banned.",
        ip_address=request.client.host if request.client else None,
    )
    create_notification(
        session,
        user=user,
        title="Account disabled",
        body="Your BuntuAsk account has been disabled. Contact support if you believe this is a mistake.",
        channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        category="ACCOUNT",
        metadata={"user_id": user.id},
    )
    session.commit()
    return {"status": "banned"}


@router.get("/conflicts")
def conflict_tasks(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    tasks = session.exec(select(Task).where(Task.status == TaskStatus.CONFLICT).order_by(Task.id)).all()
    return [serialize_task(task, session).model_dump() for task in tasks]


@router.post("/conflicts/resolve")
def resolve_conflict(
    payload: ConflictResolveRequest,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    task = session.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    submission = session.exec(select(Submission).where(Submission.task_id == task.id).order_by(Submission.id.desc())).first()
    if payload.approved and submission is not None:
        reviews = session.exec(
            select(Review).where(Review.submission_id == submission.id, Review.decision == ReviewDecision.APPROVE)
        ).all()
        distribute_approval_rewards(session, task, submission, reviews)
        task.status = TaskStatus.APPROVED
    else:
        task.status = TaskStatus.REJECTED
    session.add(task)
    write_audit(
        session,
        action=AuditAction.CONFLICT_RESOLVED,
        actor=admin_user,
        target_user_id=submission.annotator_id if submission else None,
        entity_type="task",
        entity_id=task.id,
        description=f"Conflict task {task.id} resolved as {task.status.value}.",
        metadata={"approved": payload.approved},
        ip_address=request.client.host if request.client else None,
    )
    if submission is not None:
        notify_user_id(
            session,
            user_id=submission.annotator_id,
            title="Conflict resolved",
            body=f"Admin resolved task {task.id} as {task.status.value}.",
            channels=[NotificationChannel.IN_APP],
            category="REVIEW",
            metadata={"task_id": task.id, "submission_id": submission.id, "approved": payload.approved},
        )
    session.commit()
    return {"status": task.status.value}


@router.get("/withdrawals")
def pending_withdrawals(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    transactions = session.exec(
        select(Transaction)
        .where(Transaction.status == TransactionStatus.PENDING)
        .order_by(Transaction.id.desc())
        .limit(100)
    ).all()
    return [transaction.model_dump() for transaction in transactions]


@router.post("/withdrawals/approve")
def approve_withdrawal(
    payload: WithdrawalApproveRequest,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    transaction = session.get(Transaction, payload.transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found")
    transaction.status = TransactionStatus.COMPLETED
    session.add(transaction)
    write_audit(
        session,
        action=AuditAction.WITHDRAWAL_APPROVED,
        actor=admin_user,
        target_user_id=transaction.user_id,
        entity_type="transaction",
        entity_id=transaction.id,
        description=f"Withdrawal transaction {transaction.id} approved.",
        ip_address=request.client.host if request.client else None,
    )
    notify_user_id(
        session,
        user_id=transaction.user_id,
        title="Withdrawal approved",
        body=f"Your withdrawal for ${transaction.amount:.2f} has been approved.",
        channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        category="PAYOUT",
        metadata={"transaction_id": transaction.id, "amount": transaction.amount},
    )
    session.commit()
    return {"status": "completed"}


@router.get("/audit-logs")
def audit_logs(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    logs = session.exec(select(AuditLog).order_by(AuditLog.id.desc()).limit(200)).all()
    return [log.model_dump() for log in logs]
