from app.core.config import Settings


def test_database_url_override_supports_neon_connection_strings():
    settings = Settings(
        DATABASE_URL=(
            "postgresql://plateup:password@ep-example.neon.tech/plateup"
            "?sslmode=require&channel_binding=require"
        )
    )

    assert settings.DATABASE_URL == (
        "postgresql+psycopg2://plateup:password@ep-example.neon.tech/plateup"
        "?sslmode=require&channel_binding=require"
    )


def test_local_postgres_settings_remain_supported():
    settings = Settings(
        POSTGRES_SERVER="db.local",
        POSTGRES_PORT=5433,
        POSTGRES_USER="app",
        POSTGRES_PASSWORD="safe-pass",
        POSTGRES_DB="plateup",
    )

    assert settings.DATABASE_URL == "postgresql+psycopg2://app:safe-pass@db.local:5433/plateup"
