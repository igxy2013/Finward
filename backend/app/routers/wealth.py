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
