import logging
from sqlalchemy import inspect, text
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.session import ChatSessionTable
from app.models.message import ChatMessageTable

logger = logging.getLogger(__name__)


def init_db():
    """Create all tables and run non-destructive migrations."""
    Base.metadata.create_all(bind=engine)

    try:
        inspector = inspect(engine)

        # 1. Migrate chat_messages columns
        if inspector.has_table("chat_messages"):
            msg_cols = [c["name"] for c in inspector.get_columns("chat_messages")]
            if "suggested_followups" not in msg_cols:
                db = SessionLocal()
                try:
                    db.execute(text("ALTER TABLE chat_messages ADD COLUMN suggested_followups JSON"))
                    db.commit()
                    logger.info("Migrated chat_messages: added suggested_followups column.")
                except Exception as e:
                    db.rollback()
                    logger.warning(f"Migration note (suggested_followups): {e}")
                finally:
                    db.close()

        # 2. Migrate chat_sessions columns
        if inspector.has_table("chat_sessions"):
            session_cols = [c["name"] for c in inspector.get_columns("chat_sessions")]
            db = SessionLocal()
            try:
                if "user_id" not in session_cols:
                    db.execute(text("ALTER TABLE chat_sessions ADD COLUMN user_id VARCHAR(255)"))
                    db.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)"))
                    db.commit()
                    logger.info("Migrated chat_sessions: added user_id column.")

                if "updated_at" not in session_cols:
                    db.execute(text("ALTER TABLE chat_sessions ADD COLUMN updated_at TIMESTAMP"))
                    db.commit()
                    logger.info("Migrated chat_sessions: added updated_at column.")

                if "latest_score" not in session_cols:
                    db.execute(text("ALTER TABLE chat_sessions ADD COLUMN latest_score FLOAT"))
                    db.commit()
                    logger.info("Migrated chat_sessions: added latest_score column.")
            except Exception as e:
                db.rollback()
                logger.warning(f"Migration note (chat_sessions columns): {e}")
            finally:
                db.close()

    except Exception as e:
        logger.warning(f"Migration inspection warning: {e}")
