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


@router.post("/snapshot", response_model=schemas.MonthlySnapshotOut)
def save_monthly_snapshot(
    payload: schemas.MonthlySnapshotCreate,
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    return crud.upsert_monthly_snapshot(session, user.id, payload.year, payload.month, payload.external_income)


@router.get("/snapshot", response_model=schemas.MonthlySnapshotOut | None)
def get_monthly_snapshot(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    return crud.get_monthly_snapshot(session, user.id, year, month)


@router.get("/stats", response_model=schemas.StatsOut)
def get_analytics_stats(
    months: int = Query(12, ge=1, le=36, description="返回最近N个月的趋势与当前月分布"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    return crud.analytics_stats(session, months, user.id)


@router.post("/snapshot/backfill")
def backfill_monthly_snapshots(
    months: int = Query(36, ge=1, le=120),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    count = crud.backfill_monthly_snapshots(session, user.id, months)
    return {"computed": count}
