from sqlmodel import Session, select

from app.api.notifications import create_notification
from app.models import (
    NotificationChannel,
    Project,
    ProjectPolicy,
    Review,
    ReviewDecision,
    Submission,
    Task,
    TaskStatus,
    Transaction,
    TransactionStatus,
    TransactionType,
    User,
)


def distribute_approval_rewards(session: Session, task: Task, submission: Submission, reviews: list[Review]) -> None:
    project = session.get(Project, task.project_id)
    annotator = session.get(User, submission.annotator_id)
    if project is None or annotator is None:
        return

    annotator_key = f"earning:submission:{submission.id}:annotator:{annotator.id}"
    existing_annotator_tx = session.exec(
        select(Transaction).where(Transaction.idempotency_key == annotator_key)
    ).first()
    if existing_annotator_tx is None:
        annotator.wallet_balance += project.base_reward_annotator
        session.add(
            Transaction(
                user_id=annotator.id or 0,
                amount=project.base_reward_annotator,
                type=TransactionType.EARNING,
                status=TransactionStatus.COMPLETED,
                reference_type="submission",
                reference_id=submission.id,
                idempotency_key=annotator_key,
            )
        )
        create_notification(
            session,
            user=annotator,
            title="Task approved",
            body=f"Your submission for task {task.id} was approved. You earned ${project.base_reward_annotator:.3f}.",
            channels=[NotificationChannel.IN_APP],
            category="EARNING",
            metadata={"task_id": task.id, "submission_id": submission.id},
        )

    for review in reviews:
        reviewer = session.get(User, review.reviewer_id)
        if reviewer is None:
            continue
        reviewer_key = f"earning:review:{review.id}:reviewer:{reviewer.id}"
        existing_reviewer_tx = session.exec(
            select(Transaction).where(Transaction.idempotency_key == reviewer_key)
        ).first()
        if existing_reviewer_tx is None:
            reviewer.wallet_balance += project.base_reward_reviewer
            session.add(
                Transaction(
                    user_id=reviewer.id or 0,
                    amount=project.base_reward_reviewer,
                    type=TransactionType.EARNING,
                    status=TransactionStatus.COMPLETED,
                    reference_type="review",
                    reference_id=review.id,
                    idempotency_key=reviewer_key,
                )
            )
            create_notification(
                session,
                user=reviewer,
                title="Review reward earned",
                body=f"Your review for submission {submission.id} was accepted. You earned ${project.base_reward_reviewer:.3f}.",
                channels=[NotificationChannel.IN_APP],
                category="EARNING",
                metadata={"task_id": task.id, "submission_id": submission.id, "review_id": review.id},
            )


def evaluate_consensus(session: Session, submission: Submission) -> TaskStatus:
    task = session.get(Task, submission.task_id)
    if task is None:
        raise ValueError("Task not found")

    policy = session.exec(select(ProjectPolicy).where(ProjectPolicy.project_id == task.project_id)).first()
    required_reviews = policy.required_reviews if policy else 2
    reviews = session.exec(select(Review).where(Review.submission_id == submission.id).order_by(Review.id)).all()

    if task.status == TaskStatus.APPROVED:
        return task.status

    approvals = [review for review in reviews if review.decision == ReviewDecision.APPROVE]
    rejections = [review for review in reviews if review.decision == ReviewDecision.REJECT]

    if len(approvals) >= required_reviews and not rejections:
        task.status = TaskStatus.APPROVED
        distribute_approval_rewards(session, task, submission, approvals[:required_reviews])
    elif len(reviews) >= required_reviews and rejections:
        task.status = TaskStatus.CONFLICT
    else:
        task.status = TaskStatus.PENDING_REVIEW

    session.add(task)
    return task.status
