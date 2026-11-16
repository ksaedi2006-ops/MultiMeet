import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_BACKEND = Path(__file__).resolve().parent.parent
# Keep using a database created before the MeetMind -> MultiMeet rename, so no local data is lost.
_DB_FILE = _BACKEND / "meetmind.db" if (_BACKEND / "meetmind.db").exists() and not (_BACKEND / "multimeet.db").exists() else _BACKEND / "multimeet.db"
DEFAULT_SQLITE = f"sqlite:///{_DB_FILE}"
DATABASE_URL = os.environ.get("DATABASE_URL") or DEFAULT_SQLITE

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
