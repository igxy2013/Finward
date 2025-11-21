from datetime import date
from fastapi import APIRouter, Depends, Query, status, HTTPException, Body
from sqlalchemy.orm import Session

from .. import crud, schemas, models
from ..database import get_session
from ..auth import get_current_user

router = APIRouter(prefix="/cashflows", tags=["cashflows"])


@router.get("", response_model=list[schemas.CashflowOut])
def list_cashflows(
    type: schemas.CashflowTypeLiteral | None = Query(default=None),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    hh_id = crud.get_or_create_household_id(session, user.id)
    stmt = session.query(models.Cashflow).filter(models.Cashflow.household_id == hh_id)
    if type:
        stmt = stmt.filter(models.Cashflow.type == type)
    if start:
        stmt = stmt.filter(models.Cashflow.date >= start)
    if end:
        stmt = stmt.filter(models.Cashflow.date <= end)
    stmt = stmt.order_by(models.Cashflow.date.desc(), models.Cashflow.updated_at.desc())
    return stmt.all()


@router.post("", response_model=schemas.CashflowOut, status_code=status.HTTP_201_CREATED)
def create_cashflow(payload: schemas.CashflowCreate, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    data = payload.model_dump()
    data["household_id"] = hh_id
    cf = models.Cashflow(**data)
    session.add(cf)
    session.commit()
    session.refresh(cf)
    return cf


@router.get("/{cashflow_id}", response_model=schemas.CashflowOut)
def get_cashflow(cashflow_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    cf = session.get(models.Cashflow, cashflow_id)
    if not cf:
        raise HTTPException(status_code=404, detail="Cashflow not found")
    return cf


@router.patch("/{cashflow_id}", response_model=schemas.CashflowOut)
def update_cashflow(cashflow_id: int, payload: dict = Body(...), session: Session = Depends(get_session), user = Depends(get_current_user)):
    cf = session.get(models.Cashflow, cashflow_id)
    if not cf:
        raise HTTPException(status_code=404, detail="Cashflow not found")
    for k, v in payload.items():
        if k == "type" and isinstance(v, str):
            if v in ("收入", "支出"):
                v = "income" if v == "收入" else "expense"
            try:
                v = models.CashflowType(v)
            except Exception:
                continue
        elif k == "amount" and v is not None:
            try:
                from decimal import Decimal
                v = Decimal(str(v))
            except Exception:
                continue
        elif k == "date" and v:
            try:
                from datetime import datetime
                v = datetime.strptime(str(v), "%Y-%m-%d").date()
            except Exception:
                continue
        elif k in ("planned", "recurring_monthly"):
            v = bool(v)
        setattr(cf, k, v)
    session.commit()
    session.refresh(cf)
    return cf


@router.put("/{cashflow_id}", response_model=schemas.CashflowOut)
def replace_cashflow(cashflow_id: int, payload: dict = Body(...), session: Session = Depends(get_session), user = Depends(get_current_user)):
    cf = session.get(models.Cashflow, cashflow_id)
    if not cf:
        raise HTTPException(status_code=404, detail="Cashflow not found")
    for k, v in payload.items():
        if k == "type" and isinstance(v, str):
            if v in ("收入", "支出"):
                v = "income" if v == "收入" else "expense"
            try:
                v = models.CashflowType(v)
            except Exception:
                continue
        elif k == "amount" and v is not None:
            try:
                from decimal import Decimal
                v = Decimal(str(v))
            except Exception:
                continue
        elif k == "date" and v:
            try:
                from datetime import datetime
                v = datetime.strptime(str(v), "%Y-%m-%d").date()
            except Exception:
                continue
        elif k in ("planned", "recurring_monthly"):
            v = bool(v)
        setattr(cf, k, v)
    session.commit()
    session.refresh(cf)
    return cf


@router.delete("/{cashflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cashflow(cashflow_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    cf = session.get(models.Cashflow, cashflow_id)
    if not cf:
        raise HTTPException(status_code=404, detail="Cashflow not found")
    session.delete(cf)
    session.commit()
