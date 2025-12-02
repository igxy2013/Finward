from datetime import datetime, date
from enum import Enum

from sqlalchemy import CheckConstraint, Date, DateTime, Enum as SqlEnum, Numeric, String, Text
from sqlalchemy import Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AccountType(str, Enum):
    asset = "asset"
    liability = "liability"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[AccountType] = mapped_column(SqlEnum(AccountType), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    note: Mapped[str | None] = mapped_column(Text())
    next_due_date: Mapped[date | None] = mapped_column(Date())
    loan_term_months: Mapped[int | None] = mapped_column()
    monthly_payment: Mapped[float | None] = mapped_column(Numeric(18, 2))
    annual_interest_rate: Mapped[float | None] = mapped_column(Numeric(6, 4))
    loan_start_date: Mapped[date | None] = mapped_column(Date())
    investment_term_months: Mapped[int | None] = mapped_column()
    monthly_income: Mapped[float | None] = mapped_column(Numeric(18, 2))
    invest_start_date: Mapped[date | None] = mapped_column(Date())
    depreciation_rate: Mapped[float | None] = mapped_column(Numeric(6, 4))
    household_id: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_amount_non_negative"),
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    openid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    unionid: Mapped[str | None] = mapped_column(String(64))
    nickname: Mapped[str | None] = mapped_column(String(64))
    avatar_url: Mapped[str | None] = mapped_column(String(256))
    current_household_id: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column()
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    session_key: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Household(Base):
    __tablename__ = "households"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column()
    name: Mapped[str] = mapped_column(String(80), nullable=False, default="我的家庭")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class HouseholdMember(Base):
    __tablename__ = "household_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column()
    user_id: Mapped[int] = mapped_column()
    role: Mapped[str] = mapped_column(String(16), default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column()
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class CashflowType(str, Enum):
    income = "income"
    expense = "expense"


class Cashflow(Base):
    __tablename__ = "cashflows"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column()
    type: Mapped[CashflowType] = mapped_column(SqlEnum(CashflowType), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="其他")
    planned: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_monthly: Mapped[bool] = mapped_column(Boolean, default=False)
    date: Mapped[date] = mapped_column(Date())
    note: Mapped[str | None] = mapped_column(Text())
    # 关联字段（可选）：用于标识所属资产与租客，避免依赖备注
    account_id: Mapped[int | None] = mapped_column(Integer)
    tenancy_id: Mapped[int | None] = mapped_column(Integer)
    account_name: Mapped[str | None] = mapped_column(String(80))
    tenant_name: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Tenancy(Base):
    __tablename__ = "tenancies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer)
    household_id: Mapped[int] = mapped_column(Integer)
    tenant_name: Mapped[str] = mapped_column(String(80))
    start_date: Mapped[date] = mapped_column(Date())
    end_date: Mapped[date | None] = mapped_column(Date())
    monthly_rent: Mapped[float] = mapped_column(Numeric(18, 2))
    # 收租频率：monthly/quarterly/semiannual/annual
    frequency: Mapped[str] = mapped_column(String(16), default="monthly")
    due_day: Mapped[int] = mapped_column(Integer)
    next_due_date: Mapped[date | None] = mapped_column(Date())
    contract_number: Mapped[str | None] = mapped_column(String(80))
    contract_url: Mapped[str | None] = mapped_column(String(255))
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
