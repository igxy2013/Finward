from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas, models
from ..database import get_session
from ..auth import get_current_user

router = APIRouter(prefix="/households", tags=["households"])


@router.get("", response_model=schemas.HouseholdOut)
def get_or_create_household(session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    hh = session.query(models.Household).filter(models.Household.id == hh_id).first()
    return schemas.HouseholdOut(id=hh.id, name=hh.name, owner_user_id=hh.owner_user_id)


@router.get("/members", response_model=list[schemas.MemberOut])
def get_members(session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    return crud.list_members(session, hh_id)


@router.post("/invitations", response_model=schemas.InvitationOut)
def create_invite(session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    return crud.create_invitation(session, hh_id, user.id)


@router.post("/join")
def join_household(payload: schemas.JoinIn, session: Session = Depends(get_session), user = Depends(get_current_user)):
    ok = crud.join_by_code(session, user.id, payload.code)
    if not ok:
        raise HTTPException(status_code=400, detail="邀请码无效或已过期")
    return {"joined": True}
@router.post("/backfill")
def backfill(session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    count = crud.backfill_accounts_to_household(session, hh_id)
    return {"updated": count}

@router.delete("/members/{target_user_id}")
def remove_member(target_user_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    hh_id = crud.get_or_create_household_id(session, user.id)
    hh = session.query(models.Household).filter(models.Household.id == hh_id).first()
    if not hh:
        raise HTTPException(status_code=404, detail="家庭不存在")
    if hh.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="仅创建者可移除成员")
    ok = crud.remove_member(session, hh_id, target_user_id)
    if not ok:
        raise HTTPException(status_code=400, detail="无法移除该成员")
    return {"removed": True}
