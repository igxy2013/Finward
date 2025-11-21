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
