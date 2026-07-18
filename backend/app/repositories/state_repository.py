import json
from typing import Protocol

from sqlalchemy.orm import Session

from app.db.base import AppStateRow
from app.schemas.state import AppState


class StateRepository(Protocol):
    def get(self) -> AppState | None: ...
    def save(self, state: AppState, actor: str) -> None: ...


class SqlAlchemyStateRepository:
    """Repository portable between SQLite and PostgreSQL."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self) -> AppState | None:
        row = self.session.get(AppStateRow, "main")
        return AppState.model_validate_json(row.payload) if row else None

    def save(self, state: AppState, actor: str) -> None:
        row = self.session.get(AppStateRow, "main")
        payload = json.dumps(state.model_dump(mode="json"), ensure_ascii=False, separators=(",", ":"))
        if row:
            row.payload = payload
            row.schema_version = state.version
            row.updated_by = actor
        else:
            self.session.add(AppStateRow(id="main", schema_version=state.version, payload=payload, updated_by=actor))
        self.session.commit()
