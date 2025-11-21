from __future__ import annotations
from datetime import date, datetime
from enum import Enum
from decimal import Decimal
from typing import Literal, Any

from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Optional


AccountTypeLiteral = Literal["asset", "liability"]


class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    type: AccountTypeLiteral
    category: str = Field(..., min_length=1, max_length=80)
    amount: Decimal = Field(..., ge=0)
    currency: str = Field(default="CNY", max_length=8)
    note: str | None = Field(default=None, max_length=400)
    next_due_date: date | None = None


class AccountCreate(AccountBase):
    loan_term_months: int | None = None
    monthly_payment: Decimal | None = None
    loan_start_date: date | None = None
    investment_term_months: int | None = None
    monthly_income: Decimal | None = None
    invest_start_date: date | None = None
    depreciation_rate: Decimal | None = None


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=8)
    note: str | None = Field(default=None, max_length=400)
    next_due_date: date | None = None
    loan_term_months: int | None = None
    monthly_payment: Decimal | None = None
    loan_start_date: date | None = None
    investment_term_months: int | None = None
    monthly_income: Decimal | None = None
    invest_start_date: date | None = None
    depreciation_rate: Decimal | None = None


class AccountOut(AccountBase):
    id: int
    created_at: datetime
    updated_at: datetime
    loan_term_months: int | None = None
    monthly_payment: Decimal | None = None
    loan_start_date: date | None = None
    investment_term_months: int | None = None
    monthly_income: Decimal | None = None
    invest_start_date: date | None = None
    depreciation_rate: Decimal | None = None
    initial_amount: Decimal
    current_value: Decimal

    @model_validator(mode='before')
    @classmethod
    def convert_type(cls, data: Any) -> Any:
        """Convert AccountType enum to string before validation"""
        if hasattr(data, '__dict__'):
            # SQLAlchemy model instance
            if hasattr(data, 'type') and hasattr(data.type, 'value'):
                data.type = data.type.value
        elif isinstance(data, dict):
            # Dictionary
            if 'type' in data and hasattr(data['type'], 'value'):
                data['type'] = data['type'].value
        return data

    class Config:
        from_attributes = True


class OverviewOut(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal


class TenancyCreate(BaseModel):
    account_id: int
    tenant_name: str
    start_date: date
    end_date: date | None = None
    monthly_rent: Decimal
    frequency: str = Field(default="monthly")
    due_day: int
    contract_number: str | None = None
    contract_url: str | None = None
    reminder_enabled: bool = True
    note: str | None = None


class TenancyUpdate(BaseModel):
    tenant_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    monthly_rent: Decimal | None = None
    frequency: str | None = None
    due_day: int | None = None
    contract_number: str | None = None
    contract_url: str | None = None
    reminder_enabled: bool | None = None
    note: str | None = None


class TenancyOut(BaseModel):
    id: int
    account_id: int
    household_id: int
    tenant_name: str
    start_date: date
    end_date: date | None = None
    monthly_rent: Decimal
    frequency: str
    due_day: int
    next_due_date: date | None = None
    contract_number: str | None = None
    contract_url: str | None = None
    reminder_enabled: bool
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class RentReminderOut(BaseModel):
    tenancy_id: int
    account_id: int
    tenant_name: str
    next_due_date: date
    monthly_rent: Decimal


class TrendPoint(BaseModel):
    date: date
    assets: Decimal
    liabilities: Decimal
    net_worth: Decimal


class CategorySlice(BaseModel):
    category: str
    amount: Decimal
    percentage: float


class CashflowPoint(BaseModel):
    date: date
    inflow: Decimal
    outflow: Decimal
    net: Decimal


class AnalyticsSummary(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    net_change: Decimal
    change_ratio: float
    debt_ratio: float


class AnalyticsHighlights(BaseModel):
    best_category: str | None = None
    best_category_amount: Decimal | None = None
    risk_category: str | None = None
    risk_category_amount: Decimal | None = None


class AnalyticsOut(BaseModel):
    range_days: int
    summary: AnalyticsSummary
    trend: list[TrendPoint]
    asset_categories: list[CategorySlice]
    liability_categories: list[CategorySlice]
    cashflow: list[CashflowPoint]
    highlights: AnalyticsHighlights


class WechatLoginIn(BaseModel):
    js_code: str


class LoginOut(BaseModel):
    token: str
    expires_at: datetime


class HouseholdOut(BaseModel):
    id: int
    name: str
    owner_user_id: int


class MemberOut(BaseModel):
    user_id: int
    role: str
    nickname: str | None = None
    avatar_url: str | None = None


class InvitationOut(BaseModel):
    code: str
    expires_at: datetime


class JoinIn(BaseModel):
    code: str


class UserProfileOut(BaseModel):
    id: int
    nickname: str | None = None
    avatar_url: str | None = None


class UserProfileUpdate(BaseModel):
    nickname: str | None = None
    avatar_url: str | None = None


class WealthSummaryOut(BaseModel):
    expected_expense: Decimal
    expected_income: Decimal
    actual_expense: Decimal
    actual_income: Decimal


class CashflowTypeLiteral(str, Enum):
    income = "income"
    expense = "expense"


class CashflowCreate(BaseModel):
    type: CashflowTypeLiteral
    category: str
    amount: Decimal
    planned: bool = False
    recurring_monthly: bool = False
    date: date
    note: str | None = None


class CashflowOut(BaseModel):
    id: int
    type: CashflowTypeLiteral
    category: str
    amount: Decimal
    planned: bool
    recurring_monthly: bool
    date: date
    note: str | None = None
    created_at: datetime
    updated_at: datetime



class CashflowUpdate(BaseModel):
    type: CashflowTypeLiteral | None = None
    category: str | None = None
    amount: Decimal | None = None
    planned: bool | None = None
    recurring_monthly: bool | None = None
    date: Optional[date] = None
    note: str | None = None

    @field_validator('type', mode='before')
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, str):
            if v == '收入':
                return 'income'
            if v == '支出':
                return 'expense'
        return v

    @field_validator('amount', mode='before')
    @classmethod
    def parse_amount(cls, v):
        if v is None or v == "":
            return None
        try:
            return Decimal(str(v))
        except Exception:
            return None

    @field_validator('date', mode='before')
    @classmethod
    def parse_date_field(cls, v):
        if not v:
            return None
        if isinstance(v, date):
            return v
        try:
            return datetime.strptime(str(v), "%Y-%m-%d").date()
        except Exception:
            return None
