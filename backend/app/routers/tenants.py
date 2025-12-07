from datetime import date, datetime
from fastapi import APIRouter, Depends, Query, status, HTTPException, Body
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_session
from ..auth import get_current_user
from ..crud import get_or_create_household_id

router = APIRouter(prefix="/tenants", tags=["tenants"])


def compute_next_due(start: date, due_day: int, frequency: str = "monthly", ref_date: date | None = None) -> date:
    today = ref_date or datetime.utcnow().date()
    y = today.year
    m = today.month
    d = max(1, min(28 if m == 2 else 30 if m in (4, 6, 9, 11) else 31, int(due_day or 1)))
    candidate = date(y, m, d)
    if candidate < today:
        interval = 1
        if frequency == "quarterly":
            interval = 3
        elif frequency == "semiannual":
            interval = 6
        elif frequency == "annual":
            interval = 12
        m2 = m + interval
        y2 = y + (1 if m2 > 12 else 0)
        m2 = 1 if m2 > 12 else m2
        d2 = max(1, min(28 if m2 == 2 else 30 if m2 in (4, 6, 9, 11) else 31, int(due_day or 1)))
        candidate = date(y2, m2, d2)
    if candidate < start:
        candidate = start
    return candidate


@router.get("", response_model=list[schemas.TenancyOut])
def list_tenants(account_id: int | None = Query(default=None), session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = get_or_create_household_id(session, user.id)
    stmt = session.query(models.Tenancy).filter(models.Tenancy.household_id == hh_id)
    if account_id:
        stmt = stmt.filter(models.Tenancy.account_id == account_id)
    rows = stmt.order_by(models.Tenancy.updated_at.desc()).all()
    return rows


@router.post("", response_model=schemas.TenancyOut, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: schemas.TenancyCreate, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = get_or_create_household_id(session, user.id)
    acc = session.get(models.Account, payload.account_id)
    if not acc or int(acc.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Account not found")
    data = payload.model_dump()
    next_due = compute_next_due(data["start_date"], data["due_day"], data.get("frequency", "monthly")) if data.get("due_day") else None
    t = models.Tenancy(
        account_id=payload.account_id,
        household_id=hh_id,
        tenant_name=payload.tenant_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        monthly_rent=float(payload.monthly_rent),
        frequency=payload.frequency or "monthly",
        due_day=payload.due_day,
        next_due_date=next_due,
        contract_number=payload.contract_number,
        contract_url=payload.contract_url,
        reminder_enabled=payload.reminder_enabled,
        note=payload.note,
    )
    session.add(t)
    # Sync monthly_rent to account.monthly_income
    acc.monthly_income = float(payload.monthly_rent)
    session.add(acc)
    session.commit()
    session.refresh(t)
    return t


@router.patch("/{tenancy_id}", response_model=schemas.TenancyOut)
def update_tenant(tenancy_id: int, payload: schemas.TenancyUpdate, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = get_or_create_household_id(session, user.id)
    t = session.get(models.Tenancy, tenancy_id)
    if not t or int(t.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Tenancy not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(t, k, v)
    if ("due_day" in data or "start_date" in data or "frequency" in data) and t.due_day and t.start_date:
        t.next_due_date = compute_next_due(t.start_date, t.due_day, t.frequency or "monthly")
    
    # Sync monthly_rent to account.monthly_income if changed
    if "monthly_rent" in data:
        acc = session.get(models.Account, t.account_id)
        if acc:
            acc.monthly_income = float(data["monthly_rent"])
            session.add(acc)

    session.commit()
    session.refresh(t)
    return t


@router.delete("/{tenancy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenancy_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = get_or_create_household_id(session, user.id)
    t = session.get(models.Tenancy, tenancy_id)
    if not t or int(t.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Tenancy not found")
    session.delete(t)
    session.commit()
    return None


@router.get("/rent/reminders", response_model=list[schemas.RentReminderOut])
def rent_reminders(days: int = Query(default=14, ge=1, le=90), session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = get_or_create_household_id(session, user.id)
    rows = session.query(models.Tenancy).filter(models.Tenancy.household_id == hh_id, models.Tenancy.reminder_enabled == True).all()
    today = datetime.utcnow().date()
    end = date.fromordinal(today.toordinal() + days)
    result = []
    for t in rows:
        if t.end_date and t.end_date < today:
            continue
        nd = t.next_due_date or compute_next_due(t.start_date, t.due_day, t.frequency or "monthly")
        if today <= nd <= end:
            result.append(
                schemas.RentReminderOut(
                    tenancy_id=t.id,
                    account_id=t.account_id,
                    tenant_name=t.tenant_name,
                    next_due_date=nd,
                    monthly_rent=t.monthly_rent,
                )
            )
    return result
