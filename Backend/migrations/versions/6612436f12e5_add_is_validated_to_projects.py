"""add is_validated to projects

Revision ID: 6612436f12e5
Revises: 2ccd571bd396
Create Date: 2026-08-08 07:17:59.192720

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6612436f12e5'
down_revision = '2ccd571bd396'
branch_labels = None
depends_on = None


def upgrade():
    # is_validated is now created directly in the base schema migration
    # (6b8cff34aca7) — nothing to do here.
    pass


def downgrade():
    # No-op to match upgrade() above.
    pass
