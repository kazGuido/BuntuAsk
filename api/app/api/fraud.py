from sqlmodel import Session, select

from app.api.utils import payload_text
from app.models import FraudAlert, FraudAlertType, Review, ReviewDecision, Submission, User


MIN_KEYSTROKE_RATIO = 0.6
MIN_TIME_SPENT_MS = 1200


def create_alert(session: Session, user_id: int, alert_type: FraudAlertType, description: str) -> FraudAlert:
    alert = FraudAlert(user_id=user_id, alert_type=alert_type, description=description, resolved=False)
    session.add(alert)
    return alert


def evaluate_submission(session: Session, submission: Submission, annotator: User) -> list[FraudAlert]:
    alerts: list[FraudAlert] = []
    text_length = max(len(payload_text(submission.result_payload).strip()), 1)
    ratio = submission.keystroke_count / text_length
    if ratio < MIN_KEYSTROKE_RATIO:
        annotator.trust_score = max(0.0, annotator.trust_score - 10.0)
        alerts.append(
            create_alert(
                session,
                annotator.id or 0,
                FraudAlertType.BOT_BEHAVIOR,
                f"Submission {submission.id} had keystroke ratio {ratio:.2f}.",
            )
        )

    if submission.time_spent_ms < MIN_TIME_SPENT_MS:
        annotator.trust_score = max(0.0, annotator.trust_score - 5.0)
        alerts.append(
            create_alert(
                session,
                annotator.id or 0,
                FraudAlertType.SPEED_HACK,
                f"Submission {submission.id} completed in {submission.time_spent_ms}ms.",
            )
        )
    return alerts


def evaluate_review(session: Session, submission: Submission, review: Review) -> list[FraudAlert]:
    alerts: list[FraudAlert] = []
    reviewer_id = review.reviewer_id

    if submission.annotator_id == reviewer_id:
        raise ValueError("Reviewer cannot review their own submission")

    if review.ip_address == submission.ip_address:
        alerts.append(
            create_alert(
                session,
                reviewer_id,
                FraudAlertType.COLLUSION,
                f"Reviewer IP matched submission IP for submission {submission.id}.",
            )
        )

    recent_reviews = session.exec(
        select(Review).where(Review.reviewer_id == reviewer_id).order_by(Review.id.desc()).limit(6)
    ).all()
    approving_same_annotator = 0
    for recent in recent_reviews:
        if recent.decision != ReviewDecision.APPROVE:
            break
        recent_submission = session.get(Submission, recent.submission_id)
        if recent_submission is None or recent_submission.annotator_id != submission.annotator_id:
            break
        approving_same_annotator += 1

    if review.decision == ReviewDecision.APPROVE and approving_same_annotator >= 5:
        alerts.append(
            create_alert(
                session,
                reviewer_id,
                FraudAlertType.COLLUSION,
                f"Reviewer approved annotator {submission.annotator_id} more than 5 times consecutively.",
            )
        )

    return alerts
