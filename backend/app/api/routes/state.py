from fastapi import APIRouter

from app.api.dependencies import ActorDep, StateServiceDep
from app.schemas.state import AppState, SaveResponse, StateResponse

router = APIRouter(prefix="/state", tags=["state"])


@router.get("", response_model=StateResponse)
def get_state(service: StateServiceDep) -> StateResponse:
    return StateResponse(state=service.load())


@router.put("", response_model=SaveResponse)
def put_state(payload: AppState, service: StateServiceDep, actor: ActorDep) -> SaveResponse:
    service.save(payload, actor)
    return SaveResponse()
