from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_session
from ..auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=schemas.AnalyticsOut)
def get_analytics(
    days: int = Query(30, ge=1, le=365, description="统计区间天数"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
) -> schemas.AnalyticsOut:
    return crud.analytics(session, days, user.id)


@router.get("/monthly", response_model=schemas.MonthlyOut)
def get_analytics_monthly(
    months: int = Query(12, ge=1, le=36, description="统计月份数"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
) -> schemas.MonthlyOut:
    return crud.analytics_monthly(session, months, user.id)

