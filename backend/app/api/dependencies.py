from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_session
from app.repositories.state_repository import SqlAlchemyStateRepository
from app.services.state_service import StateService


def state_service(session: Annotated[Session, Depends(get_session)]) -> StateService:
    return StateService(SqlAlchemyStateRepository(session))


def current_actor(x_authenticated_user: Annotated[str | None, Header()] = None) -> str:
    settings = get_settings()
    if x_authenticated_user:
        return x_authenticated_user
    if settings.auth_disabled:
        return "local-simulation"
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticación requerida")


StateServiceDep = Annotated[StateService, Depends(state_service)]
ActorDep = Annotated[str, Depends(current_actor)]
