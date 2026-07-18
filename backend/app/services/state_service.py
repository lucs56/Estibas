from app.repositories.state_repository import StateRepository
from app.schemas.state import AppState


class StateService:
    def __init__(self, repository: StateRepository) -> None:
        self.repository = repository

    def load(self) -> AppState | None:
        return self.repository.get()

    def save(self, state: AppState, actor: str) -> None:
        self.repository.save(state, actor)
