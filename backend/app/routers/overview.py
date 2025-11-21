from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_session
from ..auth import get_current_user

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("", response_model=schemas.OverviewOut)
def get_overview(session: Session = Depends(get_session), user = Depends(get_current_user)):
    return crud.overview(session, user.id)



