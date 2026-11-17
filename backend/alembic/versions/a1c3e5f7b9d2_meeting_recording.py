"""meeting recording: a meeting replayed from the recorded Claude bank

Revision ID: a1c3e5f7b9d2
Revises: 4b1dd955b004
Create Date: 2026-11-17 15:10:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1c3e5f7b9d2'
down_revision: Union[str, Sequence[str], None] = '4b1dd955b004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('meeting_requests') as batch:
        batch.add_column(sa.Column('recording', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('meeting_requests') as batch:
        batch.drop_column('recording')
