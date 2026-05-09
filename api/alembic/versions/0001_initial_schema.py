"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


user_role = postgresql.ENUM("ADMIN", "ANNOTATOR", "REVIEWER", name="user_role", create_type=False)
task_type = postgresql.ENUM("TEXT", "AUDIO", "IMAGE", name="task_type", create_type=False)
task_status = postgresql.ENUM(
    "AVAILABLE",
    "CLAIMED",
    "PENDING_REVIEW",
    "CONFLICT",
    "APPROVED",
    "REJECTED",
    name="task_status",
    create_type=False,
)
review_decision = postgresql.ENUM("APPROVE", "REJECT", name="review_decision", create_type=False)
transaction_type = postgresql.ENUM("EARNING", "WITHDRAWAL", name="transaction_type", create_type=False)
transaction_status = postgresql.ENUM("PENDING", "COMPLETED", name="transaction_status", create_type=False)
fraud_alert_type = postgresql.ENUM(
    "COLLUSION",
    "BOT_BEHAVIOR",
    "SPEED_HACK",
    name="fraud_alert_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    task_type.create(bind, checkfirst=True)
    task_status.create(bind, checkfirst=True)
    review_decision.create(bind, checkfirst=True)
    transaction_type.create(bind, checkfirst=True)
    transaction_status.create(bind, checkfirst=True)
    fraud_alert_type.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("whatsapp_number", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("wallet_balance", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("trust_score", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_whatsapp_number"), "users", ["whatsapp_number"], unique=False)

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("task_type", task_type, nullable=False),
        sa.Column("base_reward_annotator", sa.Float(), nullable=False),
        sa.Column("base_reward_reviewer", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=False)

    op.create_table(
        "project_policies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("required_reviews", sa.Integer(), nullable=False),
        sa.Column("min_accuracy_threshold", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_policies_project_id"), "project_policies", ["project_id"], unique=True)

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("source_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", task_status, nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tasks_locked_until"), "tasks", ["locked_until"], unique=False)
    op.create_index(op.f("ix_tasks_project_id"), "tasks", ["project_id"], unique=False)
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"], unique=False)

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("annotator_id", sa.Integer(), nullable=False),
        sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("keystroke_count", sa.Integer(), nullable=False),
        sa.Column("time_spent_ms", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["annotator_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_submissions_annotator_id"), "submissions", ["annotator_id"], unique=False)
    op.create_index(op.f("ix_submissions_task_id"), "submissions", ["task_id"], unique=False)

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("decision", review_decision, nullable=False),
        sa.Column("reason_code", sa.String(length=120), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reviews_reviewer_id"), "reviews", ["reviewer_id"], unique=False)
    op.create_index(op.f("ix_reviews_submission_id"), "reviews", ["submission_id"], unique=False)

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("type", transaction_type, nullable=False),
        sa.Column("status", transaction_status, nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_transactions_user_id"), "transactions", ["user_id"], unique=False)

    op.create_table(
        "fraud_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("alert_type", fraud_alert_type, nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_fraud_alerts_user_id"), "fraud_alerts", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_fraud_alerts_user_id"), table_name="fraud_alerts")
    op.drop_table("fraud_alerts")
    op.drop_index(op.f("ix_transactions_user_id"), table_name="transactions")
    op.drop_table("transactions")
    op.drop_index(op.f("ix_reviews_submission_id"), table_name="reviews")
    op.drop_index(op.f("ix_reviews_reviewer_id"), table_name="reviews")
    op.drop_table("reviews")
    op.drop_index(op.f("ix_submissions_task_id"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_annotator_id"), table_name="submissions")
    op.drop_table("submissions")
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_project_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_locked_until"), table_name="tasks")
    op.drop_table("tasks")
    op.drop_index(op.f("ix_project_policies_project_id"), table_name="project_policies")
    op.drop_table("project_policies")
    op.drop_index(op.f("ix_projects_name"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_users_whatsapp_number"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    fraud_alert_type.drop(bind, checkfirst=True)
    transaction_status.drop(bind, checkfirst=True)
    transaction_type.drop(bind, checkfirst=True)
    review_decision.drop(bind, checkfirst=True)
    task_status.drop(bind, checkfirst=True)
    task_type.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
