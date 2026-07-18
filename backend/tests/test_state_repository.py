from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.repositories.state_repository import SqlAlchemyStateRepository
from app.schemas.state import AppState


def sample_state() -> AppState:
    return AppState(stacks=[], lots=[], orders=[], requests=[], users=[], catalogs={}, audit=[], settings={"expirationDays": 90})


def test_state_roundtrip() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        repository = SqlAlchemyStateRepository(session)
        repository.save(sample_state(), "pytest")
        restored = repository.get()
    assert restored is not None
    assert restored.settings["expirationDays"] == 90
