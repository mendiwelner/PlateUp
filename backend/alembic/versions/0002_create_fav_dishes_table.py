"""Create favorite_dishes table.

Revision ID: 0002_create_favorite_dishes_table
Revises: 0001_create_users_table
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_create_fav_dishes_table"
down_revision: Union[str, Sequence[str], None] = "0001_create_users_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "favorite_dishes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_favorite_dishes_id"), "favorite_dishes", ["id"], unique=False)
    op.create_index(op.f("ix_favorite_dishes_user_id"), "favorite_dishes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_favorite_dishes_user_id"), table_name="favorite_dishes")
    op.drop_index(op.f("ix_favorite_dishes_id"), table_name="favorite_dishes")
    op.drop_table("favorite_dishes")
