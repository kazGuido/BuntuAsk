import logging
from typing import Annotated, Any

from datasets import load_dataset
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import require_admin
from app.api.policy import distribute_approval_rewards
from app.api.schemas import (
    ConflictResolveRequest,
    HfImportRequest,
    HfImportResponse,
    ProjectCreate,
    ProjectRead,
    WithdrawalApproveRequest,
)
from app.api.tasks import serialize_task
from app.db.session import engine, get_session
from app.models import (
    FraudAlert,
    Project,
    ProjectPolicy,
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
        name=project.name,
        task_type=project.task_type,
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

    return str(row)


def import_hf_dataset(payload: HfImportRequest) -> None:
    imported = 0
    with Session(engine) as session:
        project = session.get(Project, payload.project_id)
        if project is None:
            logger.error("HF import aborted: project %s not found", payload.project_id)
            return

        dataset = load_dataset(
            payload.hf_repo,
            payload.subset,
            split=payload.split,
            streaming=True,
        )
        for row in dataset:
            prompt = extract_prompt(dict(row))
            task = Task(
                project_id=payload.project_id,
                source_payload={
                    "prompt": prompt,
                    "hf_repo": payload.hf_repo,
                    "subset": payload.subset,
                    "split": payload.split,
                },
                status=TaskStatus.AVAILABLE,
            )
            session.add(task)
            imported += 1
            if imported % 500 == 0:
                session.commit()
            if imported >= payload.row_limit:
                break
        session.commit()
    logger.info("HF import completed for project %s: %s rows", payload.project_id, imported)


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
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> ProjectRead:
    project = Project(
        name=payload.name,
        task_type=payload.task_type,
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
    session.commit()
    session.refresh(project)
    session.refresh(policy)
    return serialize_project(project, policy)


@router.post("/import-hf", response_model=HfImportResponse, status_code=status.HTTP_202_ACCEPTED)
def import_hf(
    payload: HfImportRequest,
    background_tasks: BackgroundTasks,
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> HfImportResponse:
    if session.get(Project, payload.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    background_tasks.add_task(import_hf_dataset, payload)
    return HfImportResponse(status="queued", project_id=payload.project_id, row_limit=payload.row_limit)


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
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    alert = session.get(FraudAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.resolved = True
    session.add(alert)
    session.commit()
    return {"status": "resolved"}


@router.post("/users/{user_id}/ban")
def ban_user(
    user_id: int,
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    session.add(user)
    session.commit()
    return {"status": "banned"}


@router.get("/conflicts")
def conflict_tasks(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[dict[str, Any]]:
    tasks = session.exec(select(Task).where(Task.status == TaskStatus.CONFLICT).order_by(Task.id)).all()
    return [serialize_task(task).model_dump() for task in tasks]


@router.post("/conflicts/resolve")
def resolve_conflict(
    payload: ConflictResolveRequest,
    _admin: Annotated[User, Depends(require_admin)],
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
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    transaction = session.get(Transaction, payload.transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found")
    transaction.status = TransactionStatus.COMPLETED
    session.add(transaction)
    session.commit()
    return {"status": "completed"}
