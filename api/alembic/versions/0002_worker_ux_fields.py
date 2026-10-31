"""Worker UX user fields

Revision ID: 0002_worker_ux_fields
Revises: 0001_initial_schema
Create Date: 2026-10-31
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_worker_ux_fields"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("onboarding_completed_at", sa.DateTime(), nullable=True))
    op.add_column(
        "users",
        sa.Column("tasks_completed_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("last_active_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_active_date")
    op.drop_column("users", "current_streak")
    op.drop_column("users", "tasks_completed_count")
    op.drop_column("users", "onboarding_completed_at")
