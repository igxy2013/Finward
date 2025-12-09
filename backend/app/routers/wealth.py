from datetime import datetime, date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_session
from ..auth import get_current_user

router = APIRouter(prefix="/wealth", tags=["wealth"])


def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


@router.get("/summary", response_model=schemas.WealthSummaryOut)
def get_summary(
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    scope: str | None = Query(default=None),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    return crud.wealth_summary(session, user.id, parse_date(start), parse_date(end), scope)


@router.get("/items", response_model=list[schemas.WealthItemOut])
def get_items(
    start: str = Query(..., description="开始日期 YYYY-MM-DD"),
    end: str = Query(..., description="结束日期 YYYY-MM-DD"),
    type: str | None = Query(None, pattern="^(income|expense)$", description="可选过滤：income/expense"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    s = parse_date(start)
    e = parse_date(end)
    if not s or not e:
        return []
    return crud.wealth_items(session, user.id, s, e, type)


@router.get("/aggregate/planned", response_model=schemas.PlannedAggregateOut)
def get_planned_aggregate(
    start: str | None = Query(default=None, description="开始日期 YYYY-MM-DD，可为空"),
    end: str | None = Query(default=None, description="结束日期 YYYY-MM-DD，可为空"),
    scope: str | None = Query(default=None, description="范围：month/year/all"),
    type: str | None = Query(None, pattern="^(income|expense)$", description="可选过滤：income/expense"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    s = parse_date(start)
    e = parse_date(end)
    return crud.planned_aggregate(session, user.id, s, e, type, scope)


@router.get("/items/range", response_model=list[schemas.WealthItemOut])
def get_planned_items_range(
    start: str | None = Query(default=None, description="开始日期 YYYY-MM-DD，可为空"),
    end: str | None = Query(default=None, description="结束日期 YYYY-MM-DD，可为空"),
    scope: str | None = Query(default=None, description="范围：month/year/all"),
    type: str | None = Query(None, pattern="^(income|expense)$", description="可选过滤：income/expense"),
    include_actual: bool = Query(default=False, description="是否包含实际收支记录"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    s = parse_date(start)
    e = parse_date(end)
    return crud.planned_items_range(session, user.id, s, e, type, scope, include_actual)


@router.get("/aggregate/planned/items", response_model=list[schemas.WealthItemOut])
def get_planned_aggregate_items(
    start: str | None = Query(default=None, description="开始日期 YYYY-MM-DD，可为空"),
    end: str | None = Query(default=None, description="结束日期 YYYY-MM-DD，可为空"),
    scope: str | None = Query(default=None, description="范围：month/year/all"),
    type: str | None = Query(None, pattern="^(income|expense)$", description="可选过滤：income/expense"),
    include_actual: bool = Query(default=False, description="是否包含实际收支记录"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    s = parse_date(start)
    e = parse_date(end)
    return crud.planned_aggregate_items(session, user.id, s, e, type, scope, include_actual)
