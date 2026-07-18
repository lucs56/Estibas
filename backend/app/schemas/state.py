from typing import Any, Literal

from pydantic import BaseModel, Field


class AppState(BaseModel):
    version: Literal[4] = 4
    stacks: list[dict[str, Any]] = Field(max_length=50_000)
    lots: list[dict[str, Any]] = Field(max_length=20_000)
    orders: list[dict[str, Any]]
    requests: list[dict[str, Any]]
    users: list[dict[str, Any]]
    catalogs: dict[str, list[str]]
    audit: list[dict[str, Any]]
    settings: dict[str, Any]


class StateResponse(BaseModel):
    state: AppState | None


class SaveResponse(BaseModel):
    ok: bool = True
