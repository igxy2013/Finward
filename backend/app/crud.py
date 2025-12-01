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
            # 以创建日期为起点，按月供递减
            start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else now)
            start = start_base
            months_elapsed = max(0, (now.year - start.year) * 12 + (now.month - start.month))
            # 最多还至 loan_term_months 或本金耗尽
            payments_possible = int((amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
            limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
            paid_months = min(months_elapsed, limit, payments_possible)
            amt = max(Decimal(0), amt - Decimal(a.monthly_payment) * Decimal(paid_months))
        if t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
            # 按年直线折旧: 当前净值 = 期初金额 * (1 - rate * years)
            start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else now)
            days = max(0, (now - start_date).days)
            years = Decimal(days) / Decimal(365.25)
            rate = Decimal(a.depreciation_rate)  # 存储为小数，如 0.1 表示 10%
            amt = max(Decimal(0), amt * (Decimal(1) - rate * years))
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
                loan_start_date=a.loan_start_date,
                investment_term_months=a.investment_term_months,
                monthly_income=Decimal(a.monthly_income) if a.monthly_income is not None else None,
                invest_start_date=a.invest_start_date,
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
        start = start_base
        months_elapsed = max(0, (now.year - start.year) * 12 + (now.month - start.month))
        payments_possible = int((amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
        limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
        paid_months = min(months_elapsed, limit, payments_possible)
        amt = max(Decimal(0), amt - Decimal(a.monthly_payment) * Decimal(paid_months))
    if t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
        start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else now)
        days = max(0, (now - start_date).days)
        years = Decimal(days) / Decimal(365.25)
        rate = Decimal(a.depreciation_rate)
        amt = max(Decimal(0), amt * (Decimal(1) - rate * years))
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
        loan_start_date=a.loan_start_date,
        investment_term_months=a.investment_term_months,
        monthly_income=Decimal(a.monthly_income) if a.monthly_income is not None else None,
        invest_start_date=a.invest_start_date,
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


def wealth_summary(session: Session, user_id: int, start: date | None, end: date | None, scope: str | None = None) -> schemas.WealthSummaryOut:
    hh_id = get_or_create_household_id(session, user_id)
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
    scope_key = (scope or "").lower()
    if scope_key in {"month", "year"}:
        hh_id2 = hh_id
        stmt_acc = select(models.Account).where(models.Account.household_id == hh_id2)
        accs = session.scalars(stmt_acc).all()
        # 统一以传入的区间 [start, end] 为准，按账户起始日期截断
        end_date = end or datetime.now(timezone.utc).date()
        range_start = start or end_date
        for a in accs:
            # 负债：月供累计，起始为贷款开始或创建日期
            if a.monthly_payment and (a.loan_term_months is None or a.loan_term_months > 0):
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else end_date)
                s_eff = max(range_start, start_base)
                months_eff = 0 if end_date < s_eff else ((end_date.year - s_eff.year) * 12 + (end_date.month - s_eff.month) + 1)
                limit = a.loan_term_months if a.loan_term_months is not None else months_eff
                exp_exp += Decimal(a.monthly_payment) * Decimal(min(months_eff, limit))
            # 资产：月收益累计，起始为投资开始或创建日期
            if a.monthly_income and (a.investment_term_months is None or a.investment_term_months > 0):
                start_base2 = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else end_date)
                s_eff2 = max(range_start, start_base2)
                months_eff2 = 0 if end_date < s_eff2 else ((end_date.year - s_eff2.year) * 12 + (end_date.month - s_eff2.month) + 1)
                limit2 = a.investment_term_months if a.investment_term_months is not None else months_eff2
                exp_inc += Decimal(a.monthly_income) * Decimal(min(months_eff2, limit2))
    elif scope_key == "all":
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
                exp_exp += Decimal(a.monthly_payment) * Decimal(min(months_elapsed, limit))
            if a.monthly_income and a.monthly_income > 0:
                start_base2 = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else end_date)
                months_elapsed2 = max(1, (end_date.year - start_base2.year) * 12 + (end_date.month - start_base2.month) + 1)
                limit2 = a.investment_term_months if a.investment_term_months is not None else months_elapsed2
                exp_inc += Decimal(a.monthly_income) * Decimal(min(months_elapsed2, limit2))
    return schemas.WealthSummaryOut(
        expected_expense=exp_exp,
        expected_income=exp_inc,
        actual_expense=act_exp,
        actual_income=act_inc,
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
            total_assets += amt
        else:
            if a.monthly_payment and a.monthly_payment > 0:
                start_base = a.loan_start_date if a.loan_start_date else (to_utc(a.created_at).date() if a.created_at else now)
                start = start_base
                months_elapsed = max(0, (now.year - start.year) * 12 + (now.month - start.month))
                payments_possible = int((amt / Decimal(a.monthly_payment)).to_integral_value(rounding="ROUND_FLOOR")) if a.monthly_payment else 0
                limit = a.loan_term_months if a.loan_term_months is not None else months_elapsed
                paid_months = min(months_elapsed, limit, payments_possible)
                amt = max(Decimal(0), amt - Decimal(a.monthly_payment) * Decimal(paid_months))
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
    all_accounts = session.scalars(stmt).all()
    if not all_accounts:
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

    window_accounts = [
        account for account in all_accounts if to_utc(account.updated_at or account.created_at) >= cutoff
    ] or all_accounts

    daily_totals: dict[date, dict[str, Decimal]] = defaultdict(
        lambda: {"assets": Decimal(0), "liabilities": Decimal(0)}
    )
    category_totals: dict[tuple[str, str], Decimal] = defaultdict(Decimal)

    # 使用计算后的现值而不是期初金额
    for account in window_accounts:
        # 获取账户的现值
        current_account_value = get_account(session, account.id)
        amount = current_account_value.current_value if current_account_value else Decimal(account.amount)
        
        timestamp = to_utc(account.updated_at or account.created_at)
        day = timestamp.date()
        account_type = account.type.value if hasattr(account.type, "value") else account.type

        if account_type == "asset":
            daily_totals[day]["assets"] += amount
        else:
            daily_totals[day]["liabilities"] += amount

        category_totals[(account_type, account.category)] += amount

    sorted_days = sorted(daily_totals.keys())
    cumulative_assets = Decimal(0)
    cumulative_liabilities = Decimal(0)
    trend: list[schemas.TrendPoint] = []
    cashflow: list[schemas.CashflowPoint] = []

    for day in sorted_days:
        day_assets = daily_totals[day]["assets"]
        day_liabilities = daily_totals[day]["liabilities"]
        cumulative_assets += day_assets
        cumulative_liabilities += day_liabilities
        net = cumulative_assets - cumulative_liabilities

        trend.append(
            schemas.TrendPoint(
                date=day,
                assets=cumulative_assets,
                liabilities=cumulative_liabilities,
                net_worth=net,
            )
        )
        cashflow.append(
            schemas.CashflowPoint(
                date=day,
                inflow=day_assets,
                outflow=day_liabilities,
                net=day_assets - day_liabilities,
            )
        )

    overview_totals = overview(session, user_id)

    total_assets = overview_totals.total_assets
    total_liabilities = overview_totals.total_liabilities
    net_worth = overview_totals.net_worth

    net_change = (
        trend[-1].net_worth - trend[0].net_worth if len(trend) >= 2 else (trend[0].net_worth if trend else Decimal(0))
    )
    change_ratio = float(net_change / trend[0].net_worth * 100) if trend and trend[0].net_worth else 0.0

    def build_category_list(category_type: str) -> list[schemas.CategorySlice]:
        total = (
            total_assets if category_type == "asset" else total_liabilities
        ) or Decimal(0)
        slices: list[schemas.CategorySlice] = []
        for (type_key, category), amount in category_totals.items():
            if type_key != category_type:
                continue
            percentage = float((amount / total * 100) if total else 0)
            slices.append(
                schemas.CategorySlice(
                    category=category,
                    amount=amount,
                    percentage=round(percentage, 2),
                )
            )
        slices.sort(key=lambda item: item.amount, reverse=True)
        return slices

    asset_categories = build_category_list("asset")
    liability_categories = build_category_list("liability")

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
                paid_months = min(months_elapsed, limit, payments_possible)
                val = max(Decimal(0), base_amt - Decimal(a.monthly_payment) * Decimal(paid_months))
            elif t == "asset" and a.depreciation_rate and a.depreciation_rate > 0:
                start_date = a.invest_start_date if a.invest_start_date else (to_utc(a.created_at).date() if a.created_at else end_of_month)
                days = 0 if end_of_month < start_date else (end_of_month - start_date).days
                years = Decimal(days) / Decimal(365.25)
                rate = Decimal(a.depreciation_rate)
                val = max(Decimal(0), base_amt * (Decimal(1) - rate * years))
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

