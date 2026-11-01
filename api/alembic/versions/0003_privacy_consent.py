"""Privacy consent timestamp on users

Revision ID: 0003_privacy_consent
Revises: 0002_worker_ux_fields
Create Date: 2026-11-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_privacy_consent"
down_revision = "0002_worker_ux_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("privacy_consent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "privacy_consent_at")
