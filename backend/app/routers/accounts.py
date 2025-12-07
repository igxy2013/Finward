from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas, models
from ..database import get_session
from ..auth import get_current_user
from datetime import datetime, timezone
from fastapi import Body


router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[schemas.AccountOut])
def get_accounts(
    account_type: schemas.AccountTypeLiteral | None = Query(default=None, alias="type"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    return crud.list_accounts(session, account_type, user.id)


@router.post("", response_model=schemas.AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(payload: schemas.AccountCreate, session: Session = Depends(get_session), user = Depends(get_current_user)):
    created = crud.create_account(session, payload, user.id)
    return crud.get_account(session, created.id)


@router.patch("/{account_id}", response_model=schemas.AccountOut)
def update_account(
    account_id: int,
    payload: schemas.AccountUpdate,
    session: Session = Depends(get_session),
    user = Depends(get_current_user),
):
    updated = crud.update_account(session, account_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Account not found")
    return crud.get_account(session, account_id)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_account(account_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    deleted = crud.delete_account(session, account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")


@router.get("/{account_id}", response_model=schemas.AccountOut)
def get_account_by_id(account_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    account = crud.get_account(session, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("/{account_id}/value-updates", response_model=list[schemas.AccountValueUpdateOut])
def list_value_updates(account_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    acc = session.get(models.Account, account_id)
    if not acc or int(acc.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Account not found")
    rows = (
        session.query(models.AccountValueUpdate)
        .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == account_id)
        .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
        .all()
    )
    return rows


def _parse_ts(raw) -> datetime:
    if raw is None:
        return datetime.now(timezone.utc)
    if isinstance(raw, (int, float)):
        v = float(raw)
        if v > 1e11:
            return datetime.fromtimestamp(v / 1000.0, tz=timezone.utc)
        return datetime.fromtimestamp(v, tz=timezone.utc)
    s = str(raw)
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M")
        except Exception:
            try:
                return datetime.strptime(s, "%Y-%m-%d")
            except Exception:
                return datetime.now(timezone.utc)


@router.post("/{account_id}/value-updates", response_model=schemas.AccountValueUpdateOut, status_code=status.HTTP_201_CREATED)
def create_value_update(account_id: int, payload: dict = Body(...), session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    acc = session.get(models.Account, account_id)
    if not acc or int(acc.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Account not found")
    val_raw = payload.get("value")
    ts_raw = payload.get("ts")
    try:
        from decimal import Decimal
        val = Decimal(str(val_raw))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid value")
    ts = _parse_ts(ts_raw)
    note_raw = payload.get("note")
    row = models.AccountValueUpdate(account_id=account_id, household_id=hh_id, value=float(val), ts=ts, note=str(note_raw) if note_raw is not None else None)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.patch("/{account_id}/value-updates/{update_id}", response_model=schemas.AccountValueUpdateOut)
def update_value_update(account_id: int, update_id: int, payload: dict = Body(...), session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    acc = session.get(models.Account, account_id)
    if not acc or int(acc.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Account not found")
    row = session.get(models.AccountValueUpdate, update_id)
    if not row or int(row.household_id or 0) != int(hh_id) or int(row.account_id or 0) != int(account_id):
        raise HTTPException(status_code=404, detail="Update not found")
    if "value" in payload:
        try:
            from decimal import Decimal
            row.value = float(Decimal(str(payload.get("value"))))
        except Exception:
            pass
    if "ts" in payload:
        row.ts = _parse_ts(payload.get("ts"))
    if "note" in payload:
        v = payload.get("note")
        row.note = str(v) if v is not None else None
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.delete("/{account_id}/value-updates/{update_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_value_update(account_id: int, update_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    acc = session.get(models.Account, account_id)
    if not acc or int(acc.household_id or 0) != int(hh_id):
        raise HTTPException(status_code=404, detail="Account not found")
    row = session.get(models.AccountValueUpdate, update_id)
    if not row or int(row.household_id or 0) != int(hh_id) or int(row.account_id or 0) != int(account_id):
        raise HTTPException(status_code=404, detail="Update not found")
    session.delete(row)
    session.commit()

