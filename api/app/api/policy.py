from sqlmodel import Session, select

from app.models import (
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

    annotator.wallet_balance += project.base_reward_annotator
    session.add(
        Transaction(
            user_id=annotator.id or 0,
            amount=project.base_reward_annotator,
            type=TransactionType.EARNING,
            status=TransactionStatus.COMPLETED,
        )
    )

    for review in reviews:
        reviewer = session.get(User, review.reviewer_id)
        if reviewer is None:
            continue
        reviewer.wallet_balance += project.base_reward_reviewer
        session.add(
            Transaction(
                user_id=reviewer.id or 0,
                amount=project.base_reward_reviewer,
                type=TransactionType.EARNING,
                status=TransactionStatus.COMPLETED,
            )
        )


def evaluate_consensus(session: Session, submission: Submission) -> TaskStatus:
    task = session.get(Task, submission.task_id)
    if task is None:
        raise ValueError("Task not found")

    policy = session.exec(select(ProjectPolicy).where(ProjectPolicy.project_id == task.project_id)).first()
    required_reviews = policy.required_reviews if policy else 2
    reviews = session.exec(select(Review).where(Review.submission_id == submission.id).order_by(Review.id)).all()

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
