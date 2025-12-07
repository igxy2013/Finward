from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas
from secrets import token_hex
from datetime import timezone


def to_utc(dt: datetime) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_or_create_household_id(session: Session, user_id: int) -> int:
    user = session.get(models.User, user_id)
    if user and getattr(user, "current_household_id", None):
        return int(user.current_household_id)
    # Try membership
    member = (
        session.query(models.HouseholdMember)
        .filter(models.HouseholdMember.user_id == user_id)
        .order_by(models.HouseholdMember.joined_at.desc())
        .first()
    )
    if member:
        if user:
            user.current_household_id = member.household_id
            session.commit()
        return int(member.household_id)
    # Fallback to creating default household
    hh = ensure_default_household(session, user_id)
    if user and not getattr(user, "current_household_id", None):
        user.current_household_id = hh.id
        session.commit()
    return int(hh.id)


def list_accounts(session: Session, account_type: schemas.AccountTypeLiteral | None = None, user_id: int | None = None) -> list[models.Account]:
    stmt = select(models.Account)
    if account_type:
        stmt = stmt.where(models.Account.type == account_type)
    hh_id: int | None = None
    if user_id is not None:
        hh_id = get_or_create_household_id(session, user_id)
        stmt = stmt.where(models.Account.household_id == hh_id)
    stmt = stmt.order_by(models.Account.updated_at.desc())
    rows = session.scalars(stmt).all()
    now = datetime.now(timezone.utc).date()
    result: list[schemas.AccountOut] = []
    for a in rows:
        amt = Decimal(a.amount)
        t = a.type.value if hasattr(a.type, "value") else a.type
        if t == "liability" and a.monthly_payment and a.monthly_payment > 0:
            start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else now)
            months_elapsed = max(0, (now.year - start_base.year) * 12 + (now.month - start_base.month))
            payments_possible = int((amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
            limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
            if getattr(a, "loan_end_date", None):
                ei = a.loan_end_date.year * 12 + a.loan_end_date.month
                si = start_base.year * 12 + start_base.month
                end_cap = max(0, ei - si + 1)
                limit = min(limit, end_cap)
            paid_months = min(months_elapsed, limit, payments_possible)
            amt = max(Decimal(0), amt - Decimal(a.monthly_payment) * Decimal(paid_months))
        if t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
            # 按年直线折旧: 当前净值 = 期初金额 * (1 - rate * years)
            start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else now)
            days = max(0, (now - start_date).days)
            years = Decimal(days) / Decimal(365.25)
            rate = Decimal(a.depreciation_rate)  # 存储为小数，如 0.1 表示 10%
            amt = max(Decimal(0), amt * (Decimal(1) - rate * years))
        # 覆盖当前净值：若存在最新的现值更新记录，则以其为准
        try:
            if hh_id is None:
                hh_id = a.household_id
            latest = (
                session.query(models.AccountValueUpdate)
                .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == a.id)
                .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
                .first()
            )
            if latest and latest.value is not None:
                amt = Decimal(latest.value)
        except Exception:
            pass

        result.append(
            schemas.AccountOut(
                id=a.id,
                name=a.name,
                type=t,
                category=a.category,
                amount=amt,
                currency=a.currency,
                note=a.note,
                next_due_date=a.next_due_date,
                created_at=to_utc(a.created_at) if a.created_at else datetime.now(timezone.utc),
                updated_at=to_utc(a.updated_at) if a.updated_at else datetime.now(timezone.utc),
                loan_term_months=a.loan_term_months,
                monthly_payment=Decimal(a.monthly_payment) if a.monthly_payment is not None else None,
                annual_interest_rate=Decimal(a.annual_interest_rate) if getattr(a, "annual_interest_rate", None) is not None else None,
                loan_start_date=a.loan_start_date,
                loan_end_date=getattr(a, "loan_end_date", None),
                investment_term_months=a.investment_term_months,
                monthly_income=Decimal(a.monthly_income) if a.monthly_income is not None else None,
                invest_start_date=a.invest_start_date,
                invest_end_date=getattr(a, "invest_end_date", None),
                depreciation_rate=Decimal(a.depreciation_rate) if a.depreciation_rate is not None else None,
                initial_amount=Decimal(a.amount),
                current_value=amt,
            )
        )
    return result


def get_account(session: Session, account_id: int) -> schemas.AccountOut | None:
    a = session.get(models.Account, account_id)
    if not a:
        return None
    now = datetime.now(timezone.utc).date()
    amt = Decimal(a.amount)
    t = a.type.value if hasattr(a.type, "value") else a.type
    if t == "liability" and a.monthly_payment and a.monthly_payment > 0:
        start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else now)
        months_elapsed = max(0, (now.year - start_base.year) * 12 + (now.month - start_base.month))
        payments_possible = int((amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
        limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
        # 结束日期上限：若存在 loan_end_date，则以结束月份为上限
        if getattr(a, "loan_end_date", None):
            ei = a.loan_end_date.year * 12 + a.loan_end_date.month
            si = start_base.year * 12 + start_base.month
            end_cap = max(0, ei - si + 1)
            limit = min(limit, end_cap)
        paid_months = min(months_elapsed, limit, payments_possible)
        amt = max(Decimal(0), amt - Decimal(a.monthly_payment) * Decimal(paid_months))
    if t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
        start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else now)
        days = max(0, (now - start_date).days)
        years = Decimal(days) / Decimal(365.25)
        rate = Decimal(a.depreciation_rate)
        amt = max(Decimal(0), amt * (Decimal(1) - rate * years))
    # 覆盖当前净值：若存在最新的现值更新记录，则以其为准
    try:
        latest = (
            session.query(models.AccountValueUpdate)
            .filter(models.AccountValueUpdate.household_id == a.household_id, models.AccountValueUpdate.account_id == a.id)
            .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
            .first()
        )
        if latest and latest.value is not None:
            amt = Decimal(latest.value)
    except Exception:
        pass

    return schemas.AccountOut(
        id=a.id,
        name=a.name,
        type=t,
        category=a.category,
        amount=amt,
        currency=a.currency,
        note=a.note,
        next_due_date=a.next_due_date,
        created_at=to_utc(a.created_at) if a.created_at else datetime.now(timezone.utc),
        updated_at=to_utc(a.updated_at) if a.updated_at else datetime.now(timezone.utc),
        loan_term_months=a.loan_term_months,
        monthly_payment=Decimal(a.monthly_payment) if a.monthly_payment is not None else None,
        annual_interest_rate=Decimal(a.annual_interest_rate) if getattr(a, "annual_interest_rate", None) is not None else None,
        loan_start_date=a.loan_start_date,
        loan_end_date=getattr(a, "loan_end_date", None),
        investment_term_months=a.investment_term_months,
        monthly_income=Decimal(a.monthly_income) if a.monthly_income is not None else None,
        invest_start_date=a.invest_start_date,
        invest_end_date=getattr(a, "invest_end_date", None),
        depreciation_rate=Decimal(a.depreciation_rate) if a.depreciation_rate is not None else None,
        initial_amount=Decimal(a.amount),
        current_value=amt,
    )


def create_account(session: Session, payload: schemas.AccountCreate, user_id: int) -> models.Account:
    hh_id = get_or_create_household_id(session, user_id)
    data = payload.model_dump()
    data["household_id"] = hh_id
    account = models.Account(**data)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def update_account(session: Session, account_id: int, payload: schemas.AccountUpdate) -> models.Account | None:
    account = session.get(models.Account, account_id)
    if not account:
        return None

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, key, value)

    session.commit()
    session.refresh(account)
    return account


def delete_account(session: Session, account_id: int) -> bool:
    account = session.get(models.Account, account_id)
    if not account:
        return False
    session.delete(account)
    session.commit()
    return True


def ensure_default_household(session: Session, user_id: int) -> models.Household:
    hh = session.query(models.Household).filter(models.Household.owner_user_id == user_id).first()
    if not hh:
        hh = models.Household(owner_user_id=user_id, name="我的家庭")
        session.add(hh)
        session.commit()
        session.refresh(hh)
        member = models.HouseholdMember(household_id=hh.id, user_id=user_id, role="owner")
        session.add(member)
        session.commit()
    user = session.get(models.User, user_id)
    if user and not getattr(user, "current_household_id", None):
        user.current_household_id = hh.id
        session.commit()
    return hh


def list_members(session: Session, household_id: int) -> list[schemas.MemberOut]:
    members = session.query(models.HouseholdMember).filter(models.HouseholdMember.household_id == household_id).all()
    results: list[schemas.MemberOut] = []
    for m in members:
        u = session.get(models.User, m.user_id)
        results.append(
            schemas.MemberOut(
                user_id=m.user_id,
                role=m.role,
                nickname=(getattr(u, "nickname", None) if u else None),
                avatar_url=(getattr(u, "avatar_url", None) if u else None),
            )
        )
    return results

def remove_member(session: Session, household_id: int, target_user_id: int) -> bool:
    hh = session.get(models.Household, household_id)
    if not hh:
        return False
    if hh.owner_user_id == target_user_id:
        return False
    member = (
        session.query(models.HouseholdMember)
        .filter(models.HouseholdMember.household_id == household_id)
        .filter(models.HouseholdMember.user_id == target_user_id)
        .first()
    )
    if not member:
        return False
    session.delete(member)
    session.commit()
    user = session.get(models.User, target_user_id)
    if user and user.current_household_id == household_id:
        user.current_household_id = None
        session.commit()
    return True


def create_invitation(session: Session, household_id: int, creator_user_id: int) -> schemas.InvitationOut:
    now = datetime.now(timezone.utc)
    code = token_hex(4).upper()
    invite = models.Invitation(
        household_id=household_id,
        code=code,
        expires_at=now + timedelta(days=3),
        created_by_user_id=creator_user_id,
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    return schemas.InvitationOut(code=invite.code, expires_at=invite.expires_at)


def join_by_code(session: Session, user_id: int, code: str) -> bool:
    def to_utc(dt: datetime) -> datetime:
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    normalized = (code or "").strip().upper()
    if not normalized:
        return False
    invite = session.query(models.Invitation).filter(models.Invitation.code == normalized).first()
    if not invite or to_utc(invite.expires_at) <= now:
        return False
    exists = session.query(models.HouseholdMember).filter(
        models.HouseholdMember.household_id == invite.household_id,
        models.HouseholdMember.user_id == user_id,
    ).first()
    if not exists:
        member = models.HouseholdMember(household_id=invite.household_id, user_id=user_id, role="member")
        session.add(member)
        session.commit()
    # Set current household to joined one
    user = session.get(models.User, user_id)
    if user:
        user.current_household_id = invite.household_id
        session.commit()
    return True


def backfill_accounts_to_household(session: Session, household_id: int) -> int:
    updated = session.query(models.Account).filter(models.Account.household_id.is_(None)).update(
        {models.Account.household_id: household_id}
    )
    session.commit()
    return int(updated or 0)


def wealth_summary(session: Session, user_id: int, start: date | None, end: date | None, scope: str | None) -> schemas.WealthSummaryOut:
    hh_id = get_or_create_household_id(session, user_id)
    if scope and scope.lower() == "month" and start and end and start.year == end.year and start.month == end.month:
        y = start.year
        m = start.month
        snap = (
            session.query(models.MonthlySnapshot)
            .filter(models.MonthlySnapshot.household_id == hh_id, models.MonthlySnapshot.year == y, models.MonthlySnapshot.month == m)
            .first()
        )
        if snap:
            from decimal import Decimal as D
            ei = D(snap.expected_income or 0)
            ee = D(snap.expected_expense or 0)
            ai = D(snap.actual_income or 0)
            ae = D(snap.actual_expense or 0)
            ext = D(snap.external_income or 0)
            return schemas.WealthSummaryOut(
                expected_expense=ee,
                expected_income=ei + ext,
                actual_expense=ae,
                actual_income=ai,
            )
    base = select(models.Cashflow).where(models.Cashflow.household_id == hh_id)
    if start:
        base = base.where(models.Cashflow.date >= start)
    if end:
        base = base.where(models.Cashflow.date <= end)
    rows = session.scalars(base).all()
    exp_exp = Decimal(0)
    exp_inc = Decimal(0)
    act_exp = Decimal(0)
    act_inc = Decimal(0)
    for r in rows:
        amt = Decimal(r.amount)
        s = start or r.date
        s = max(s, r.date)
        e = end or r.date
        if e < s:
            continue
        multiplier = 1
        if getattr(r, "recurring_monthly", False):
            multiplier = max(1, ((e.year - s.year) * 12 + (e.month - s.month) + 1))
        if r.type.value == "expense":
            if r.planned:
                exp_exp += amt * Decimal(multiplier)
            else:
                act_exp += amt * Decimal(multiplier)
        else:
            if r.planned:
                exp_inc += amt * Decimal(multiplier)
            else:
                act_inc += amt * Decimal(multiplier)

    stmt_rec = (
        select(models.Cashflow)
        .where(models.Cashflow.household_id == hh_id)
        .where(models.Cashflow.recurring_monthly == True)
    )
    rec_rows = session.scalars(stmt_rec).all()
    for r in rec_rows:
        # 若已包含在当前区间的 rows 中，跳过以免重复
        if start and end and (r.date >= start and r.date <= end):
            continue
        amt = Decimal(r.amount)
        rs = r.recurring_start_date or r.date
        re = r.recurring_end_date or (end or rs)
        s_eff = max(start or rs, rs)
        e_eff = min(end or re, re)
        if e_eff < s_eff:
            continue
        months = ((e_eff.year - s_eff.year) * 12 + (e_eff.month - s_eff.month) + 1)
        if months <= 0:
            continue
        if r.type.value == "expense":
            if r.planned:
                exp_exp += amt * Decimal(months)
            else:
                act_exp += amt * Decimal(months)
        else:
            if r.planned:
                exp_inc += amt * Decimal(months)
            else:
                act_inc += amt * Decimal(months)
    scope_key = (scope or "").lower()
    # 推断有效统计范围：当未显式提供 scope，但提供了同月的 start/end，则视为按月统计
    is_same_month = bool(start and end and start.year == end.year and start.month == end.month)
    effective_scope_key = scope_key if scope_key in {"month", "year", "all"} else ("month" if is_same_month else "")
    if effective_scope_key in {"month", "year"}:
        hh_id2 = hh_id
        stmt_acc = select(models.Account).where(models.Account.household_id == hh_id2)
        accs = session.scalars(stmt_acc).all()
        end_date = end or datetime.now(timezone.utc).date()
        range_start = start or end_date
        from calendar import monthrange as _mr
        def _clamp_day(yy: int, mm: int, dd: int) -> int:
            return max(1, min(_mr(yy, mm)[1], int(dd or 1)))
        start_idx = range_start.year * 12 + range_start.month
        end_idx = end_date.year * 12 + end_date.month
        for a in accs:
            if a.monthly_payment and Decimal(a.monthly_payment) > 0 and (a.loan_term_months is None or a.loan_term_months > 0):
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else range_start)
                sidx = start_base.year * 12 + start_base.month
                term = int(a.loan_term_months or 0)
                loan_end = getattr(a, "loan_end_date", None)
                for idx in range(start_idx, end_idx + 1):
                    if idx < sidx:
                        continue
                    yy = idx // 12
                    mm = idx % 12
                    if mm == 0:
                        yy -= 1
                        mm = 12
                    dd = _clamp_day(yy, mm, start_base.day)
                    cand = date(yy, mm, dd)
                    if cand < start_base:
                        continue
                    if loan_end and cand > loan_end:
                        break
                    months_elapsed = idx - sidx
                    if term > 0 and months_elapsed >= term:
                        break
                    exp_exp += Decimal(a.monthly_payment)
            if a.monthly_income and Decimal(a.monthly_income) > 0 and (a.investment_term_months is None or a.investment_term_months > 0):
                start_base2 = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else range_start)
                sidx2 = start_base2.year * 12 + start_base2.month
                term2 = int(a.investment_term_months or 0)
                invest_end = getattr(a, "invest_end_date", None)
                for idx in range(start_idx, end_idx + 1):
                    if idx < sidx2:
                        continue
                    yy = idx // 12
                    mm = idx % 12
                    if mm == 0:
                        yy -= 1
                        mm = 12
                    dd = _clamp_day(yy, mm, start_base2.day)
                    cand = date(yy, mm, dd)
                    if cand < start_base2:
                        continue
                    if invest_end and cand > invest_end:
                        break
                    months_elapsed2 = idx - sidx2
                    if term2 > 0 and months_elapsed2 >= term2:
                        break
                    exp_inc += Decimal(a.monthly_income)
    elif effective_scope_key == "all":
        # 全部范围：账号的月供/月收益按各自起始日至“end”进行月度累加，并受期限限制
        hh_id2 = hh_id
        stmt_acc = select(models.Account).where(models.Account.household_id == hh_id2)
        accs = session.scalars(stmt_acc).all()
        end_date = end or datetime.now(timezone.utc).date()
        for a in accs:
            if a.monthly_payment and a.monthly_payment > 0:
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else end_date)
                months_elapsed = max(1, (end_date.year - start_base.year) * 12 + (end_date.month - start_base.month) + 1)
                limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
                if getattr(a, "loan_end_date", None):
                    ei = a.loan_end_date.year * 12 + a.loan_end_date.month
                    si = start_base.year * 12 + start_base.month
                    end_cap = max(0, ei - si + 1)
                    limit = min(limit, end_cap)
                exp_exp += Decimal(a.monthly_payment) * Decimal(min(months_elapsed, limit))
            if a.monthly_income and a.monthly_income > 0:
                start_base2 = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else end_date)
                months_elapsed2 = max(1, (end_date.year - start_base2.year) * 12 + (end_date.month - start_base2.month) + 1)
                limit2 = a.investment_term_months if a.investment_term_months is not None else months_elapsed2
                if getattr(a, "invest_end_date", None):
                    ei2 = a.invest_end_date.year * 12 + a.invest_end_date.month
                    si2 = start_base2.year * 12 + start_base2.month
                    end_cap2 = max(0, ei2 - si2 + 1)
                    limit2 = min(limit2, end_cap2)
                exp_inc += Decimal(a.monthly_income) * Decimal(min(months_elapsed2, limit2))
    # 若为“按月”统计，叠加快照中的 external_income 以与前端列表保持一致
    # 仅在显式 scope=month 时叠加快照 external_income（避免快照计算时重复计入）
    if scope_key == "month" and start and end and start.year == end.year and start.month == end.month:
        try:
            snap = get_monthly_snapshot(session, user_id, start.year, start.month)
            if snap and snap.external_income:
                ext = Decimal(snap.external_income or 0)
                if ext > 0:
                    exp_inc += ext
        except Exception:
            pass

    return schemas.WealthSummaryOut(
        expected_expense=exp_exp,
        expected_income=exp_inc,
        actual_expense=act_exp,
        actual_income=act_inc,
    )


def upsert_monthly_snapshot(session: Session, user_id: int, year: int, month: int, external_income: Decimal | None = None) -> schemas.MonthlySnapshotOut:
    hh_id = get_or_create_household_id(session, user_id)
    start = date(year, month, 1)
    from calendar import monthrange
    last_day = monthrange(year, month)[1]
    end = date(year, month, last_day)
    summary = wealth_summary(session, user_id, start, end, scope=None)
    ext = Decimal(external_income or 0)
    snap = (
        session.query(models.MonthlySnapshot)
        .filter(models.MonthlySnapshot.household_id == hh_id, models.MonthlySnapshot.year == year, models.MonthlySnapshot.month == month)
        .first()
    )
    now = datetime.now(timezone.utc)
    if snap:
        snap.expected_income = float(summary.expected_income)
        snap.expected_expense = float(summary.expected_expense)
        snap.actual_income = float(summary.actual_income)
        snap.actual_expense = float(summary.actual_expense)
        snap.external_income = float(ext) if external_income is not None else snap.external_income
        snap.computed_at = now
    else:
        snap = models.MonthlySnapshot(
            household_id=hh_id,
            year=year,
            month=month,
            expected_income=float(summary.expected_income),
            expected_expense=float(summary.expected_expense),
            actual_income=float(summary.actual_income),
            actual_expense=float(summary.actual_expense),
            external_income=float(ext) if external_income is not None else None,
            computed_at=now,
        )
        session.add(snap)
    session.commit()
    session.refresh(snap)
    return schemas.MonthlySnapshotOut(
        year=year,
        month=month,
        expected_income=Decimal(snap.expected_income or 0),
        expected_expense=Decimal(snap.expected_expense or 0),
        actual_income=Decimal(snap.actual_income or 0),
        actual_expense=Decimal(snap.actual_expense or 0),
        external_income=Decimal(snap.external_income or 0) if snap.external_income is not None else None,
        computed_at=snap.computed_at,
    )


def get_monthly_snapshot(session: Session, user_id: int, year: int, month: int) -> schemas.MonthlySnapshotOut | None:
    hh_id = get_or_create_household_id(session, user_id)
    snap = (
        session.query(models.MonthlySnapshot)
        .filter(models.MonthlySnapshot.household_id == hh_id, models.MonthlySnapshot.year == year, models.MonthlySnapshot.month == month)
        .first()
    )
    if not snap:
        return None
    return schemas.MonthlySnapshotOut(
        year=year,
        month=month,
        expected_income=Decimal(snap.expected_income or 0),
        expected_expense=Decimal(snap.expected_expense or 0),
        actual_income=Decimal(snap.actual_income or 0),
        actual_expense=Decimal(snap.actual_expense or 0),
        external_income=Decimal(snap.external_income or 0) if snap.external_income is not None else None,
        computed_at=snap.computed_at,
    )


def overview(session: Session, user_id: int) -> schemas.OverviewOut:
    hh_id = get_or_create_household_id(session, user_id)
    stmt = select(models.Account).where(models.Account.household_id == hh_id)
    accounts = session.scalars(stmt).all()
    now = datetime.now(timezone.utc).date()
    total_assets = Decimal(0)
    total_liabilities = Decimal(0)
    for a in accounts:
        amt = Decimal(a.amount)
        t = a.type.value if hasattr(a.type, "value") else a.type
        if t == "asset":
            if a.depreciation_rate and a.depreciation_rate > 0:
                start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else now)
                days = max(0, (now - start_date).days)
                years = Decimal(days) / Decimal(365.25)
                rate = Decimal(a.depreciation_rate)
                amt = max(Decimal(0), amt * (Decimal(1) - rate * years))
            try:
                latest = (
                    session.query(models.AccountValueUpdate)
                    .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == a.id)
                    .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
                    .first()
                )
                if latest and latest.value is not None:
                    amt = Decimal(latest.value)
            except Exception:
                pass
            total_assets += amt
        else:
            if a.monthly_payment and a.monthly_payment > 0:
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else now)
                months_elapsed = max(0, (now.year - start_base.year) * 12 + (now.month - start_base.month))
                payments_possible = int((amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
                limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
                if getattr(a, "loan_end_date", None):
                    ei = a.loan_end_date.year * 12 + a.loan_end_date.month
                    si = start_base.year * 12 + start_base.month
                    end_cap = max(0, ei - si + 1)
                    limit = min(limit, end_cap)
                paid_months = min(months_elapsed, limit, payments_possible)
                amt = max(Decimal(0), amt - Decimal(a.monthly_payment) * Decimal(paid_months))
            try:
                latest = (
                    session.query(models.AccountValueUpdate)
                    .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == a.id)
                    .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
                    .first()
                )
                if latest and latest.value is not None:
                    amt = Decimal(latest.value)
            except Exception:
                pass
            total_liabilities += amt
    net_worth = total_assets - total_liabilities
    return schemas.OverviewOut(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=net_worth,
    )


def analytics(session: Session, days: int, user_id: int) -> schemas.AnalyticsOut:
    days = max(1, min(days, 365))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    def to_utc(dt: datetime) -> datetime:
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    hh_id = get_or_create_household_id(session, user_id)
    stmt = select(models.Account).where(models.Account.household_id == hh_id).order_by(models.Account.created_at.asc())
    accounts = session.scalars(stmt).all()
    if not accounts:
        zero = Decimal(0)
        return schemas.AnalyticsOut(
            range_days=days,
            summary=schemas.AnalyticsSummary(
                total_assets=zero,
                total_liabilities=zero,
                net_worth=zero,
                net_change=zero,
                change_ratio=0.0,
            ),
            trend=[],
            asset_categories=[],
            liability_categories=[],
            cashflow=[],
            highlights=schemas.AnalyticsHighlights(),
        )

    start_day = cutoff.date()
    end_day = datetime.now(timezone.utc).date()

    trend: list[schemas.TrendPoint] = []
    cashflow: list[schemas.CashflowPoint] = []

    cur_day = start_day
    while cur_day <= end_day:
        assets_total = Decimal(0)
        liabilities_total = Decimal(0)
        for a in accounts:
            base_amt = Decimal(a.amount)
            t = a.type.value if hasattr(a.type, "value") else a.type
            val = base_amt
            if t == "liability" and a.monthly_payment and a.monthly_payment > 0:
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else cur_day)
                months_elapsed = 0 if cur_day < start_base else ((cur_day.year - start_base.year) * 12 + (cur_day.month - start_base.month))
                payments_possible = int((base_amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
                limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
                if getattr(a, "loan_end_date", None):
                    ei = a.loan_end_date.year * 12 + a.loan_end_date.month
                    si = start_base.year * 12 + start_base.month
                    end_cap = max(0, ei - si + 1)
                    limit = min(limit, end_cap)
                paid_months = min(months_elapsed, limit, payments_possible)
                val = max(Decimal(0), base_amt - Decimal(a.monthly_payment) * Decimal(paid_months))
            elif t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
                start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else cur_day)
                days_elapsed = 0 if cur_day < start_date else (cur_day - start_date).days
                years = Decimal(days_elapsed) / Decimal(365.25)
                rate = Decimal(a.depreciation_rate)
                val = max(Decimal(0), base_amt * (Decimal(1) - rate * years))
            try:
                latest = (
                    session.query(models.AccountValueUpdate)
                    .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == a.id)
                    .filter(models.AccountValueUpdate.ts <= datetime(cur_day.year, cur_day.month, cur_day.day, 23, 59, 59, tzinfo=timezone.utc))
                    .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
                    .first()
                )
                if latest and latest.value is not None:
                    val = Decimal(latest.value)
            except Exception:
                pass
            if t == "asset":
                assets_total += val
            else:
                liabilities_total += val
        net = assets_total - liabilities_total
        trend.append(schemas.TrendPoint(date=cur_day, assets=assets_total, liabilities=liabilities_total, net_worth=net))
        cashflow.append(schemas.CashflowPoint(date=cur_day, inflow=assets_total, outflow=liabilities_total, net=net))
        cur_day = date.fromordinal(cur_day.toordinal() + 1)

    overview_totals = overview(session, user_id)
    total_assets = overview_totals.total_assets
    total_liabilities = overview_totals.total_liabilities
    net_worth = overview_totals.net_worth

    net_change = trend[-1].net_worth - trend[0].net_worth if len(trend) >= 2 else (trend[0].net_worth if trend else Decimal(0))
    change_ratio = float(net_change / trend[0].net_worth * 100) if trend and trend[0].net_worth else 0.0

    category_totals: dict[tuple[str, str], Decimal] = defaultdict(Decimal)
    for a in accounts:
        base_amt = Decimal(a.amount)
        t = a.type.value if hasattr(a.type, "value") else a.type
        val = base_amt
        if t == "liability" and a.monthly_payment and a.monthly_payment > 0:
            start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else end_day)
            months_elapsed = 0 if end_day < start_base else ((end_day.year - start_base.year) * 12 + (end_day.month - start_base.month))
            payments_possible = int((base_amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
            limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
            if getattr(a, "loan_end_date", None):
                ei = a.loan_end_date.year * 12 + a.loan_end_date.month
                si = start_base.year * 12 + start_base.month
                end_cap = max(0, ei - si + 1)
                limit = min(limit, end_cap)
            paid_months = min(months_elapsed, limit, payments_possible)
            val = max(Decimal(0), base_amt - Decimal(a.monthly_payment) * Decimal(paid_months))
        elif t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
            start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else end_day)
            days_elapsed = 0 if end_day < start_date else (end_day - start_date).days
            years = Decimal(days_elapsed) / Decimal(365.25)
            rate = Decimal(a.depreciation_rate)
            val = max(Decimal(0), base_amt * (Decimal(1) - rate * years))
        try:
            latest = (
                session.query(models.AccountValueUpdate)
                .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == a.id)
                .filter(models.AccountValueUpdate.ts <= datetime(end_day.year, end_day.month, end_day.day, 23, 59, 59, tzinfo=timezone.utc))
                .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
                .first()
            )
            if latest and latest.value is not None:
                val = Decimal(latest.value)
        except Exception:
            pass
        category_totals[(t, a.category)] += val

    def build_category_list(category_type: str) -> list[schemas.CategorySlice]:
        total = total_assets if category_type == "asset" else total_liabilities
        total = total or Decimal(0)
        slices: list[schemas.CategorySlice] = []
        for (type_key, category), amount in category_totals.items():
            if type_key != category_type:
                continue
            percentage = float((amount / total * 100) if total else 0)
            slices.append(schemas.CategorySlice(category=category, amount=amount, percentage=round(percentage, 2)))
        slices.sort(key=lambda item: item.amount, reverse=True)
        return slices

    asset_categories = build_category_list("asset")
    liability_categories = build_category_list("liability")

    # 确保走势最后一天与顶部统计卡片一致（以 overview 为准）
    if trend:
        last = trend[-1]
        trend[-1] = schemas.TrendPoint(date=last.date, assets=total_assets, liabilities=total_liabilities, net_worth=net_worth)
        if cashflow:
            cf_last = cashflow[-1]
            cashflow[-1] = schemas.CashflowPoint(date=cf_last.date, inflow=total_assets, outflow=total_liabilities, net=net_worth)

    highlights = schemas.AnalyticsHighlights(
        best_category=asset_categories[0].category if asset_categories else None,
        best_category_amount=asset_categories[0].amount if asset_categories else None,
        risk_category=liability_categories[0].category if liability_categories else None,
        risk_category_amount=liability_categories[0].amount if liability_categories else None,
    )

    summary = schemas.AnalyticsSummary(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=net_worth,
        net_change=net_change,
        change_ratio=round(change_ratio, 2),
        debt_ratio=round(float((total_liabilities / total_assets * 100) if total_assets else 0.0), 2),
    )

    return schemas.AnalyticsOut(
        range_days=days,
        summary=summary,
        trend=trend,
        asset_categories=asset_categories,
        liability_categories=liability_categories,
        cashflow=cashflow,
        highlights=highlights,
    )


def analytics_monthly(session: Session, months: int, user_id: int) -> schemas.MonthlyOut:
    months = max(1, min(months, 36))
    hh_id = get_or_create_household_id(session, user_id)
    stmt = select(models.Account).where(models.Account.household_id == hh_id).order_by(models.Account.created_at.asc())
    accounts = session.scalars(stmt).all()
    points: list[schemas.MonthlyPoint] = []
    if not accounts:
        return schemas.MonthlyOut(months=months, points=points)
    from calendar import monthrange
    today = datetime.now(timezone.utc).date()
    start_year = today.year
    start_month = today.month
    for i in range(months - 1, -1, -1):
        y = start_year
        m = start_month - i
        while m <= 0:
            m += 12
            y -= 1
        last_day = monthrange(y, m)[1]
        end_of_month = date(y, m, last_day)
        assets_total = Decimal(0)
        liabilities_total = Decimal(0)
        for a in accounts:
            base_amt = Decimal(a.amount)
            t = a.type.value if hasattr(a.type, "value") else a.type
            val = base_amt
            if t == "liability" and a.monthly_payment and a.monthly_payment > 0:
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else end_of_month)
                months_elapsed = 0 if end_of_month < start_base else ((end_of_month.year - start_base.year) * 12 + (end_of_month.month - start_base.month))
                payments_possible = int((base_amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
                limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
                if getattr(a, "loan_end_date", None):
                    ei = a.loan_end_date.year * 12 + a.loan_end_date.month
                    si = start_base.year * 12 + start_base.month
                    end_cap = max(0, ei - si + 1)
                    limit = min(limit, end_cap)
                paid_months = min(months_elapsed, limit, payments_possible)
                val = max(Decimal(0), base_amt - Decimal(a.monthly_payment) * Decimal(paid_months))
            elif t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
                start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else end_of_month)
                days = 0 if end_of_month < start_date else (end_of_month - start_date).days
                years = Decimal(days) / Decimal(365.25)
                rate = Decimal(a.depreciation_rate)
                val = max(Decimal(0), base_amt * (Decimal(1) - rate * years))
            # 覆盖为该月末最新的现值更新（若存在，以 ts <= 月末为准）
            try:
                latest = (
                    session.query(models.AccountValueUpdate)
                    .filter(models.AccountValueUpdate.household_id == hh_id, models.AccountValueUpdate.account_id == a.id)
                    .filter(models.AccountValueUpdate.ts <= end_of_month)
                    .order_by(models.AccountValueUpdate.ts.desc(), models.AccountValueUpdate.created_at.desc())
                    .first()
                )
                if latest and latest.value is not None:
                    val = Decimal(latest.value)
            except Exception:
                pass
            if t == "asset":
                assets_total += val
            else:
                liabilities_total += val
        net = assets_total - liabilities_total
        debt_ratio = float((liabilities_total / assets_total * 100) if assets_total else 0.0)
        points.append(
            schemas.MonthlyPoint(
                month=date(y, m, 1),
                total_assets=assets_total,
                total_liabilities=liabilities_total,
                net_worth=net,
                debt_ratio=round(debt_ratio, 2),
            )
        )
    return schemas.MonthlyOut(months=months, points=points)


def analytics_stats(session: Session, months: int, user_id: int) -> schemas.StatsOut:
    months = max(1, min(months, 36))
    from calendar import monthrange
    hh_id = get_or_create_household_id(session, user_id)

    today = datetime.now(timezone.utc).date()
    start_year = today.year
    start_month = today.month

    labels: list[str] = []
    income_trend: list[Decimal] = []
    expense_trend: list[Decimal] = []

    def ym_at(index: int) -> tuple[int, int]:
        y = start_year
        m = start_month - index
        while m <= 0:
            m += 12
            y -= 1
        return y, m

    def month_range(y: int, m: int) -> tuple[date, date]:
        first = date(y, m, 1)
        last = date(y, m, monthrange(y, m)[1])
        return first, last

    # 构建趋势（按月的预计收入/预计支出），优先使用快照
    for i in range(months - 1, -1, -1):
        y, m = ym_at(i)
        start, end = month_range(y, m)
        summary = wealth_summary(session, user_id, start, end, scope="month")
        labels.append(f"{y}-{str(m).zfill(2)}")
        income_trend.append(Decimal(summary.expected_income or 0))
        expense_trend.append(Decimal(summary.expected_expense or 0))

    # 当前月分布（收入/支出）
    cur_y, cur_m = ym_at(0)
    cur_start, cur_end = month_range(cur_y, cur_m)

    # 记录的现金流（限定在当前月）
    cf_stmt = (
        session.query(models.Cashflow)
        .filter(models.Cashflow.household_id == hh_id)
        .filter(models.Cashflow.date >= cur_start)
        .filter(models.Cashflow.date <= cur_end)
    )
    cfs = cf_stmt.order_by(models.Cashflow.date.asc()).all()
    recorded_income = [r for r in cfs if r.type.value == "income" and r.planned]
    recorded_expense = [r for r in cfs if r.type.value == "expense" and r.planned]

    # 资产与负债账户
    acc_stmt = select(models.Account).where(models.Account.household_id == hh_id)
    accounts = session.scalars(acc_stmt).all()
    assets = [a for a in accounts if (a.type.value if hasattr(a.type, "value") else a.type) == "asset"]
    liabilities = [a for a in accounts if (a.type.value if hasattr(a.type, "value") else a.type) == "liability"]

    # 计算租金提醒（当前月）
    ten_stmt = session.query(models.Tenancy).filter(models.Tenancy.household_id == hh_id, models.Tenancy.reminder_enabled == True)
    tenancies = ten_stmt.all()

    def clamp_day(yy: int, mm: int, dd: int) -> int:
        dim = monthrange(yy, mm)[1]
        return max(1, min(dim, int(dd or 1)))

    def compute_next_due(start_dt: date, due_day: int, frequency: str = "monthly", ref_date: date | None = None) -> date:
        today2 = ref_date or datetime.now(timezone.utc).date()
        y2 = today2.year
        m2 = today2.month
        d2 = clamp_day(y2, m2, due_day)
        candidate = date(y2, m2, d2)
        if candidate < today2:
            interval = 1
            if frequency == "quarterly":
                interval = 3
            elif frequency == "semiannual":
                interval = 6
            elif frequency == "annual":
                interval = 12
            m3 = m2 + interval
            y3 = y2 + (1 if m3 > 12 else 0)
            m3 = 1 if m3 > 12 else m3
            d3 = clamp_day(y3, m3, due_day)
            candidate = date(y3, m3, d3)
        if candidate < start_dt:
            candidate = start_dt
        return candidate

    def in_range(ds: date | None) -> bool:
        return bool(ds and (cur_start <= ds <= cur_end))

    rent_incomes: list[tuple[str, Decimal]] = []
    rented_asset_ids: set[int] = set()
    for t in tenancies:
        if t.end_date and t.end_date < cur_start:
            continue
        nd = t.next_due_date or compute_next_due(t.start_date, t.due_day, t.frequency or "monthly")
        if in_range(nd):
            rent_incomes.append(("租金收入", Decimal(t.monthly_rent or 0)))
            if t.account_id:
                rented_asset_ids.add(int(t.account_id))

    # 资产月收益（排除已出租资产）
    asset_incomes: list[tuple[str, Decimal]] = []
    for a in assets:
        if a.monthly_income and Decimal(a.monthly_income) > 0:
            if a.id and int(a.id) in rented_asset_ids:
                continue
            # 投资结束日期上限：若当前月份超过 invest_end_date，跳过
            if getattr(a, "invest_end_date", None):
                cur_idx = cur_y * 12 + cur_m
                ei = a.invest_end_date.year * 12 + a.invest_end_date.month
                if cur_idx > ei:
                    continue
            cat = a.category or "资产收益"
            asset_incomes.append((cat, Decimal(a.monthly_income)))

    # 负债月供（当前月内）
    expense_debts: list[tuple[str, Decimal]] = []
    for acc in liabilities:
        mp = Decimal(acc.monthly_payment or 0)
        if mp <= 0:
            continue
        start_base = acc.loan_start_date if acc.loan_start_date else (to_utc(acc.created_at).date() if acc.created_at else cur_start)
        # 计算本月应付的日子
        due_day = start_base.day
        dnum = clamp_day(cur_y, cur_m, due_day)
        cand = date(cur_y, cur_m, dnum)
        if cand < start_base:
            continue
        if getattr(acc, "loan_end_date", None) and cand > acc.loan_end_date:
            continue
        term = int(acc.loan_term_months or 0)
        months_elapsed = max(0, (cur_y - start_base.year) * 12 + (cur_m - start_base.month))
        if term > 0 and months_elapsed >= term:
            continue
        expense_debts.append(((acc.category or "负债") + "月供", mp))

    # 上月的循环计划项，用于当前月补齐缺失的重复项（收入/支出）
    prev_m = cur_m - 1
    prev_y = cur_y
    if prev_m <= 0:
        prev_m += 12
        prev_y -= 1
    prev_start, prev_end = month_range(prev_y, prev_m)
    prev_stmt = (
        session.query(models.Cashflow)
        .filter(models.Cashflow.household_id == hh_id)
        .filter(models.Cashflow.date >= prev_start)
        .filter(models.Cashflow.date <= prev_end)
    )
    prev_cfs = prev_stmt.order_by(models.Cashflow.date.asc()).all()
    recorded_income_keys = set(f"income:{(r.category or '')}:{(r.note or r.category or '')}" for r in recorded_income if r.recurring_monthly)
    recorded_expense_keys = set(f"expense:{(r.category or '')}:{(r.note or r.category or '')}" for r in recorded_expense if r.recurring_monthly)

    synth_income: list[tuple[str, Decimal]] = []
    synth_expense: list[tuple[str, Decimal]] = []
    for r in prev_cfs:
        key = f"{r.type.value}:{(r.category or '')}:{(r.note or r.category or '')}"
        if not r.planned or not r.recurring_monthly:
            continue
        # 对齐到当前月份的日期（沿用上月的 day）
        prev_day = r.date.day
        dnum2 = clamp_day(cur_y, cur_m, prev_day)
        cand2 = date(cur_y, cur_m, dnum2)
        # 结束/开始日期限定
        if getattr(r, "recurring_end_date", None) and cand2 > r.recurring_end_date:
            continue
        if getattr(r, "recurring_start_date", None) and cand2 < r.recurring_start_date:
            continue
        if cur_start <= cand2 <= cur_end:
            if r.type.value == "income" and key not in recorded_income_keys:
                synth_income.append((r.category or "其他收入", Decimal(r.amount or 0)))
            if r.type.value == "expense" and key not in recorded_expense_keys:
                synth_expense.append((r.category or "其他支出", Decimal(r.amount or 0)))

    # 组装分布
    def canon_income(name: str, note: str | None = None) -> str:
        base = (name or "").strip() or "其他收入"
        hay = f"{base} {note or ''}".lower()
        if ("工资" in hay) or ("薪资" in hay) or ("薪水" in hay) or ("salary" in hay):
            return "工资"
        if "租金" in hay:
            return "租金收入"
        if ("设计服务" in hay) or ("设计" in hay):
            return "设计服务"
        return base

    income_buckets: dict[str, Decimal] = {}
    for r in recorded_income:
        cat = canon_income(r.category or "其他收入", r.note)
        income_buckets[cat] = income_buckets.get(cat, Decimal(0)) + Decimal(r.amount or 0)
    for name, amt in rent_incomes:
        income_buckets[name] = income_buckets.get(name, Decimal(0)) + amt
    for name, amt in asset_incomes:
        cat = canon_income(name)
        income_buckets[cat] = income_buckets.get(cat, Decimal(0)) + amt
    for name, amt in synth_income:
        cat = canon_income(name)
        income_buckets[cat] = income_buckets.get(cat, Decimal(0)) + amt

    expense_buckets: dict[str, Decimal] = {}
    for r in recorded_expense:
        cat = (r.category or "其他支出").strip() or "其他支出"
        expense_buckets[cat] = expense_buckets.get(cat, Decimal(0)) + Decimal(r.amount or 0)
    for name, amt in expense_debts:
        expense_buckets[name] = expense_buckets.get(name, Decimal(0)) + amt
    for name, amt in synth_expense:
        cat = (name or "其他支出").strip() or "其他支出"
        expense_buckets[cat] = expense_buckets.get(cat, Decimal(0)) + amt

    def build_distribution(buckets: dict[str, Decimal], kind: str) -> list[schemas.CategorySlice]:
        entries = [(k, v) for k, v in buckets.items() if v and v > 0]
        entries.sort(key=lambda kv: kv[1], reverse=True)
        if not entries:
            return []
        MAX_SEG = 6
        pinned_income = {"工资", "工资收入", "薪资", "租金收入", "设计服务"}
        pinned = pinned_income if kind == "income" else set()
        by_name = {name: amt for name, amt in entries}
        pinned_list = [(n, by_name[n]) for n in pinned if n in by_name]
        remaining = [(n, a) for (n, a) in entries if n not in pinned]
        processed: list[tuple[str, Decimal]] = []
        if len(pinned_list) >= MAX_SEG - 1:
            major = pinned_list[: MAX_SEG - 1]
            others_val = sum(a for _, a in remaining) + sum(a for _, a in pinned_list[MAX_SEG - 1 :])
            processed = major + [("其他收入" if kind == "income" else "其他支出", Decimal(others_val))]
        else:
            slots = MAX_SEG - 1 - len(pinned_list)
            major = pinned_list + remaining[: max(slots, 0)]
            if len(major) < len(entries):
                others_val = sum(a for (n, a) in entries if n not in [x for x, _ in major])
                major = major + [("其他收入" if kind == "income" else "其他支出", Decimal(others_val))]
            processed = major
        total = sum(a for _, a in processed) or Decimal(1)
        result: list[schemas.CategorySlice] = []
        for idx, (name, amt) in enumerate(processed):
            pct = float((amt / total * 100))
            result.append(schemas.CategorySlice(category=name, amount=amt, percentage=round(pct, 1)))
        return result

    income_distribution = build_distribution(income_buckets, "income")
    expense_distribution = build_distribution(expense_buckets, "expense")

    # 当前月 summary（用于前端显示预计收入/预计支出）
    current_summary = wealth_summary(session, user_id, cur_start, cur_end, scope="month")

    return schemas.StatsOut(
        months=months,
        labels=labels,
        income_trend=income_trend,
        expense_trend=expense_trend,
        income_distribution=income_distribution,
        expense_distribution=expense_distribution,
        summary=current_summary,
    )


def wealth_items(session: Session, user_id: int, start: date, end: date, type_filter: str | None = None) -> list[schemas.WealthItemOut]:
    hh_id = get_or_create_household_id(session, user_id)
    from calendar import monthrange

    def clamp_day(yy: int, mm: int, dd: int) -> int:
        dim = monthrange(yy, mm)[1]
        return max(1, min(dim, int(dd or 1)))

    def month_bounds(d: date) -> tuple[int, int]:
        return d.year, d.month

    y, m = month_bounds(start)
    # 1. 当月真实现金流
    q = (
        session.query(models.Cashflow)
        .filter(models.Cashflow.household_id == hh_id)
        .filter(models.Cashflow.date >= start)
        .filter(models.Cashflow.date <= end)
        .order_by(models.Cashflow.date.asc())
    )
    rows = q.all()
    recorded: list[schemas.WealthItemOut] = []
    for r in rows:
        tval = r.type.value if hasattr(r.type, "value") else r.type
        if type_filter and type_filter in {"income", "expense"} and tval != type_filter:
            continue
        recorded.append(
            schemas.WealthItemOut(
                id=str(r.id),
                type=tval,
                category=r.category or ("其他收入" if tval == "income" else "其他支出"),
                amount=Decimal(r.amount or 0),
                planned=bool(r.planned),
                recurring_monthly=bool(getattr(r, "recurring_monthly", False)),
                date=r.date,
                note=r.note,
                account_id=r.account_id,
                tenancy_id=r.tenancy_id,
                account_name=r.account_name,
                tenant_name=r.tenant_name,
                name=r.note or r.category,
            )
        )

    # 2. 计算当月租金提醒（Tenancy）
    ten_stmt = session.query(models.Tenancy).filter(
        models.Tenancy.household_id == hh_id,
        models.Tenancy.reminder_enabled == True,
    )
    tenancies = ten_stmt.all()

    def compute_next_due(start_dt: date, due_day: int, frequency: str = "monthly", ref_date: date | None = None) -> date:
        today2 = ref_date or datetime.now(timezone.utc).date()
        y2 = today2.year
        m2 = today2.month
        d2 = clamp_day(y2, m2, due_day)
        candidate = date(y2, m2, d2)
        if candidate < today2:
            interval = 1
            if frequency == "quarterly":
                interval = 3
            elif frequency == "semiannual":
                interval = 6
            elif frequency == "annual":
                interval = 12
            m3 = m2 + interval
            y3 = y2 + (1 if m3 > 12 else 0)
            m3 = 1 if m3 > 12 else m3
            d3 = clamp_day(y3, m3, due_day)
            candidate = date(y3, m3, d3)
        if candidate < start_dt:
            candidate = start_dt
        return candidate

    def in_range(ds: date | None) -> bool:
        return bool(ds and (start <= ds <= end))

    rent_items: list[schemas.WealthItemOut] = []
    rented_asset_ids: set[int] = set()
    for t in tenancies:
        if t.end_date and t.end_date < start:
            continue
        nd = t.next_due_date or compute_next_due(t.start_date, t.due_day, t.frequency or "monthly", ref_date=start)
        if in_range(nd):
            if t.account_id:
                rented_asset_ids.add(int(t.account_id))
            if not type_filter or type_filter == "income":
                rent_items.append(
                    schemas.WealthItemOut(
                        id=f"tenancy:{t.id}",
                        type="income",
                        category="租金收入",
                        amount=Decimal(t.monthly_rent or 0),
                        planned=True,
                        recurring_monthly=False,
                        date=nd,
                        account_id=t.account_id,
                        tenancy_id=t.id,
                        tenant_name=t.tenant_name,
                        name="租金收入",
                        synthetic_kind="rent",
                    )
                )

    # 3. 资产月收益（排除出租资产）
    acc_stmt = select(models.Account).where(models.Account.household_id == hh_id)
    accounts = session.scalars(acc_stmt).all()
    asset_income_items: list[schemas.WealthItemOut] = []
    for a in accounts:
        tval = a.type.value if hasattr(a.type, "value") else a.type
        if tval != "asset":
            continue
        mi = Decimal(a.monthly_income or 0)
        if mi <= 0:
            continue
        if a.id and int(a.id) in rented_asset_ids:
            continue
        # 起止限定
        started = True
        months_elapsed = 0
        if a.invest_start_date:
            sdt = a.invest_start_date
            si = sdt.year * 12 + sdt.month
            mi_idx = y * 12 + m
            months_elapsed = mi_idx - si
            if months_elapsed < 0:
                started = False
        if not started:
            continue
        term = int(a.investment_term_months or 0)
        if term > 0 and months_elapsed >= term:
            continue
        # 投资结束日期上限
        if getattr(a, "invest_end_date", None):
            ei = a.invest_end_date.year * 12 + a.invest_end_date.month
            if (y * 12 + m) > ei:
                continue
        if not type_filter or type_filter == "income":
            asset_income_items.append(
                schemas.WealthItemOut(
                    id=f"asset-income:{a.id}:{y}{str(m).zfill(2)}",
                    type="income",
                    category=a.category or "资产收益",
                    amount=mi,
                    planned=True,
                    recurring_monthly=True,
                    date=end,
                    account_id=a.id,
                    account_name=a.name,
                    name=a.category or "资产收益",
                    synthetic_kind="asset-income",
                )
            )

    # 4. 负债月供（当前月内）
    debt_items: list[schemas.WealthItemOut] = []
    for a in accounts:
        tval = a.type.value if hasattr(a.type, "value") else a.type
        if tval != "liability":
            continue
        mp = Decimal(a.monthly_payment or 0)
        if mp <= 0:
            continue
        start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else start)
        due_day = start_base.day
        yy, mm = y, m
        while True:
            dd = clamp_day(yy, mm, due_day)
            cand = date(yy, mm, dd)
            if cand < start_base:
                mm += 1
                if mm > 12:
                    mm = 1
                    yy += 1
                continue
            if cand > end:
                break
            # 结束日期上限
            if getattr(a, "loan_end_date", None) and cand > a.loan_end_date:
                break
            term = int(a.loan_term_months or 0)
            months_elapsed = max(0, (yy - start_base.year) * 12 + (mm - start_base.month))
            if term > 0 and months_elapsed >= term:
                break
            if not type_filter or type_filter == "expense":
                debt_items.append(
                    schemas.WealthItemOut(
                        id=f"loan:{a.id}:{yy}{str(mm).zfill(2)}",
                        type="expense",
                        category=(a.category or "负债") + "月供",
                        amount=mp,
                        planned=True,
                        recurring_monthly=True,
                        date=cand,
                        account_id=a.id,
                        account_name=a.name,
                        name=(a.category or "负债") + "月供",
                        synthetic_kind="loan-payment",
                    )
                )
            mm += 1
            if mm > 12:
                mm = 1
                yy += 1

    # 5. 上月的循环计划项补齐（收入/支出），若当前月未记录
    prev_y = y if m > 1 else y - 1
    prev_m = (m - 1) if m > 1 else 12
    from calendar import monthrange as mr
    prev_start = date(prev_y, prev_m, 1)
    prev_end = date(prev_y, prev_m, mr(prev_y, prev_m)[1])
    prev_rows = (
        session.query(models.Cashflow)
        .filter(models.Cashflow.household_id == hh_id)
        .filter(models.Cashflow.date >= prev_start)
        .filter(models.Cashflow.date <= prev_end)
        .order_by(models.Cashflow.date.asc())
        .all()
    )
    recorded_keys = set(
        f"{i.type}:{(i.category or '')}:{(i.name or i.category or '')}"
        for i in recorded
        if i.recurring_monthly and i.planned
    )
    synth_items: list[schemas.WealthItemOut] = []
    for r in prev_rows:
        if not r.planned or not getattr(r, "recurring_monthly", False):
            continue
        key = f"{r.type.value}:{(r.category or '')}:{(r.note or r.category or '')}"
        if key in recorded_keys:
            continue
        prev_day = r.date.day
        dnum = clamp_day(y, m, prev_day)
        cand = date(y, m, dnum)
        # 结束/开始日期限定
        if getattr(r, "recurring_end_date", None) and cand > r.recurring_end_date:
            continue
        if getattr(r, "recurring_start_date", None) and cand < r.recurring_start_date:
            continue
        if start <= cand <= end:
            tval2 = r.type.value if hasattr(r.type, "value") else r.type
            if not type_filter or type_filter == tval2:
                synth_items.append(
                    schemas.WealthItemOut(
                        id=f"recurring:{r.id}:{y}{str(m).zfill(2)}",
                        type=tval2,
                        category=r.category or ("其他收入" if tval2 == "income" else "其他支出"),
                        amount=Decimal(r.amount or 0),
                        planned=True,
                        recurring_monthly=True,
                        date=cand,
                        account_id=r.account_id,
                        account_name=r.account_name,
                        name=r.note or r.category,
                        synthetic_kind=f"recurring-{tval2}",
                    )
                )

    # 5a. 基于主数据的循环计划项（按起止日期生成历史月份条目）
    recurring_master_items: list[schemas.WealthItemOut] = []
    master_rows = (
        session.query(models.Cashflow)
        .filter(models.Cashflow.household_id == hh_id)
        .filter(models.Cashflow.planned == True)
        .filter(getattr(models.Cashflow, "recurring_monthly") == True)
        .all()
    )
    for r in master_rows:
        # 限定在起止范围内
        rsd = getattr(r, "recurring_start_date", None) or r.date
        red = getattr(r, "recurring_end_date", None)
        if rsd and rsd > end:
            continue
        if red and red < start:
            continue
        # 本月计划发生日：沿用起始日的 day（或原记录日），并做月末夹紧
        base_day = (rsd if rsd else r.date).day
        dnum = clamp_day(y, m, base_day)
        cand = date(y, m, dnum)
        if not (start <= cand <= end):
            continue
        tval2 = r.type.value if hasattr(r.type, "value") else r.type
        if type_filter and type_filter in {"income", "expense"} and tval2 != type_filter:
            continue
        # 若当月已有同类循环计划记录，则不重复生成
        key = f"{tval2}:{(r.category or '')}:{(r.note or r.category or '')}"
        if key in recorded_keys:
            continue
        recurring_master_items.append(
            schemas.WealthItemOut(
                id=f"recurring:{r.id}:{y}{str(m).zfill(2)}",
                type=tval2,
                category=r.category or ("其他收入" if tval2 == "income" else "其他支出"),
                amount=Decimal(r.amount or 0),
                planned=True,
                recurring_monthly=True,
                date=cand,
                account_id=r.account_id,
                account_name=r.account_name,
                name=r.note or r.category,
                synthetic_kind=f"recurring-{tval2}",
            )
        )

    # 6. 外部统计（如有），从快照取 external_income 合成设计服务条目
    snap = get_monthly_snapshot(session, user_id, y, m)
    external_items: list[schemas.WealthItemOut] = []
    if snap and snap.external_income and (not type_filter or type_filter == "income"):
        ext_amt = Decimal(snap.external_income or 0)
        if ext_amt > 0:
            external_items.append(
                schemas.WealthItemOut(
                    id=f"design-service:{y}{str(m).zfill(2)}",
                    type="income",
                    category="设计服务",
                    amount=ext_amt,
                    planned=True,
                    recurring_monthly=False,
                    date=end,
                    name="设计服务",
                    synthetic_kind="design-service",
                )
            )

    items = recorded + rent_items + asset_income_items + debt_items + synth_items + recurring_master_items + external_items
    # 去重（以 id 唯一）
    seen: set[str] = set()
    result: list[schemas.WealthItemOut] = []
    for it in items:
        if it.id in seen:
            continue
        seen.add(it.id)
        result.append(it)
    # 排序：日期倒序
    result.sort(key=lambda x: str(x.date), reverse=True)
    return result
