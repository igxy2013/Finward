from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_session
from ..auth import get_current_user


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



