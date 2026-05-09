from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.audit import write_audit
from app.api.deps import get_current_user, require_admin
from app.api.notifications import create_notification, notify_user_id
from app.api.schemas import ProjectApprovalRequest, ProjectCreate, ProjectRead
from app.api.utils import client_ip
from app.db.session import get_session
from app.models import (
    AuditAction,
    NotificationChannel,
    Project,
    ProjectPolicy,
    ProjectStatus,
    User,
    UserRole,
)


router = APIRouter(prefix="/projects", tags=["projects"])


def serialize_project(project: Project, policy: ProjectPolicy | None) -> ProjectRead:
    return ProjectRead(
        id=project.id or 0,
        owner_id=project.owner_id,
        approved_by_id=project.approved_by_id,
        name=project.name,
        description=project.description,
        language=project.language,
        guidelines=project.guidelines,
        sample_payload=project.sample_payload,
        task_type=project.task_type,
        workflow=project.workflow,
        status=project.status,
        base_reward_annotator=project.base_reward_annotator,
        base_reward_reviewer=project.base_reward_reviewer,
        required_reviews=policy.required_reviews if policy else 2,
        min_accuracy_threshold=policy.min_accuracy_threshold if policy else 0.8,
    )


@router.get("/mine", response_model=list[ProjectRead])
def my_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ProjectRead]:
    projects = session.exec(select(Project).where(Project.owner_id == current_user.id).order_by(Project.id.desc())).all()
    result = []
    for project in projects:
        policy = session.exec(select(ProjectPolicy).where(ProjectPolicy.project_id == project.id)).first()
        result.append(serialize_project(project, policy))
    return result


@router.post("", response_model=ProjectRead, status_code=status.HTTP_202_ACCEPTED)
def propose_project(
    payload: ProjectCreate,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> ProjectRead:
    project = Project(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        language=payload.language,
        guidelines=payload.guidelines,
        sample_payload=payload.sample_payload,
        task_type=payload.task_type,
        workflow=payload.workflow,
        status=ProjectStatus.PENDING_APPROVAL,
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
        action=AuditAction.PROJECT_SUBMITTED,
        actor=current_user,
        target_user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        description=f"Project {project.name} submitted for admin approval.",
        metadata=payload.model_dump(mode="json"),
        ip_address=client_ip(request),
    )
    create_notification(
        session,
        user=current_user,
        title="Project submitted",
        body=f"Project '{project.name}' is pending admin validation before tasks can go live.",
        channels=[NotificationChannel.IN_APP],
        category="PROJECT",
        metadata={"project_id": project.id, "workflow": project.workflow.value},
    )
    admins = session.exec(select(User).where(User.role == UserRole.ADMIN, User.is_active == True)).all()  # noqa: E712
    for admin in admins:
        notify_user_id(
            session,
            user_id=admin.id or 0,
            title="Project awaiting approval",
            body=f"{current_user.username} submitted '{project.name}' for validation.",
            channels=[NotificationChannel.IN_APP],
            category="PROJECT",
            metadata={"project_id": project.id, "workflow": project.workflow.value},
        )
    session.commit()
    session.refresh(project)
    session.refresh(policy)
    return serialize_project(project, policy)


@router.get("/pending", response_model=list[ProjectRead])
def pending_projects(
    _admin: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ProjectRead]:
    projects = session.exec(select(Project).where(Project.status == ProjectStatus.PENDING_APPROVAL).order_by(Project.id)).all()
    result = []
    for project in projects:
        policy = session.exec(select(ProjectPolicy).where(ProjectPolicy.project_id == project.id)).first()
        result.append(serialize_project(project, policy))
    return result


@router.post("/approve")
def approve_project(
    payload: ProjectApprovalRequest,
    request: Request,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    project = session.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.status != ProjectStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is not pending approval")

    project.status = ProjectStatus.ACTIVE if payload.approved else ProjectStatus.REJECTED
    project.approved_by_id = admin_user.id if payload.approved else None
    session.add(project)
    write_audit(
        session,
        action=AuditAction.PROJECT_APPROVED if payload.approved else AuditAction.PROJECT_REJECTED,
        actor=admin_user,
        target_user_id=project.owner_id,
        entity_type="project",
        entity_id=project.id,
        description=f"Project {project.name} {'approved' if payload.approved else 'rejected'} by admin.",
        metadata={"reason": payload.reason, "workflow": project.workflow.value},
        ip_address=client_ip(request),
    )
    if project.owner_id:
        notify_user_id(
            session,
            user_id=project.owner_id,
            title="Project approved" if payload.approved else "Project rejected",
            body=f"Project '{project.name}' was {'approved and is now live' if payload.approved else 'rejected'}." + (f" Reason: {payload.reason}" if payload.reason else ""),
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            category="PROJECT",
            metadata={"project_id": project.id, "status": project.status.value},
        )
    session.commit()
    return {"status": project.status.value}
