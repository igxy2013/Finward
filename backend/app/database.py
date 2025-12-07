from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


settings = get_settings()


class Base(DeclarativeBase):
    pass


def ensure_database_exists():
    """Create database if it doesn't exist"""
    try:
        engine_no_db = create_engine(settings.sqlalchemy_url_no_db, echo=False)
        with engine_no_db.connect() as conn:
            # Check if database exists
            result = conn.execute(
                text(f"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '{settings.db_name}'")
            )
            if not result.fetchone():
                # Create database
                conn.execute(text(f"CREATE DATABASE `{settings.db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                conn.commit()
        engine_no_db.dispose()
    except Exception as e:
        print(f"Warning: Could not ensure database exists: {e}")


engine = create_engine(settings.sqlalchemy_url, echo=settings.db_echo, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def ensure_schema_upgrade():
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'household_id'
                """),
                {"db": settings.db_name},
            )
            exists = result.scalar() or 0
            if not exists:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN household_id INT NULL"))
                conn.commit()

            result2 = conn.execute(
                text("""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'current_household_id'
                """),
                {"db": settings.db_name},
            )
            exists2 = result2.scalar() or 0
            if not exists2:
                conn.execute(text("ALTER TABLE users ADD COLUMN current_household_id INT NULL"))
                conn.commit()

            try:
                tbl_exists = conn.execute(
                    text(
                        """
                        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                        WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows'
                        """
                    ),
                    {"db": settings.db_name},
                ).scalar() or 0

                if tbl_exists:
                    result3 = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'category'
                            """
                        ),
                        {"db": settings.db_name},
                    )
                    exists3 = result3.scalar() or 0
                    if not exists3:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT '其他'"))
                        conn.commit()
                    result4 = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'recurring_monthly'
                            """
                        ),
                        {"db": settings.db_name},
                    )
                    if not (result4.scalar() or 0):
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN recurring_monthly TINYINT(1) NOT NULL DEFAULT 0"))
                        conn.commit()
                    rsd = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'recurring_start_date'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not rsd:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN recurring_start_date DATE NULL"))
                        conn.commit()
                    red = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'recurring_end_date'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not red:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN recurring_end_date DATE NULL"))
                        conn.commit()
                    # Add relational reference columns if missing
                    cf_acc = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'account_id'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not cf_acc:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN account_id INT NULL"))
                        conn.commit()
                    cf_ten = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'tenancy_id'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not cf_ten:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN tenancy_id INT NULL"))
                        conn.commit()
                    cf_aname = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'account_name'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not cf_aname:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN account_name VARCHAR(80) NULL"))
                        conn.commit()
                    cf_tname = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'cashflows' AND COLUMN_NAME = 'tenant_name'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not cf_tname:
                        conn.execute(text("ALTER TABLE cashflows ADD COLUMN tenant_name VARCHAR(80) NULL"))
                        conn.commit()
            except OperationalError:
                pass

            ms_tbl_exists = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'monthly_snapshots'
                    """
                ),
                {"db": settings.db_name},
            ).scalar() or 0
            if not ms_tbl_exists:
                conn.execute(
                    text(
                        """
                        CREATE TABLE `monthly_snapshots` (
                          `id` INT NOT NULL AUTO_INCREMENT,
                          `household_id` INT NOT NULL,
                          `year` INT NOT NULL,
                          `month` INT NOT NULL,
                          `expected_income` DECIMAL(18,2) NOT NULL DEFAULT 0,
                          `expected_expense` DECIMAL(18,2) NOT NULL DEFAULT 0,
                          `actual_income` DECIMAL(18,2) NOT NULL DEFAULT 0,
                          `actual_expense` DECIMAL(18,2) NOT NULL DEFAULT 0,
                          `external_income` DECIMAL(18,2) NULL,
                          `total_assets` DECIMAL(18,2) NULL,
                          `total_liabilities` DECIMAL(18,2) NULL,
                          `net_worth` DECIMAL(18,2) NULL,
                          `debt_ratio` DECIMAL(6,2) NULL,
                          `computed_at` DATETIME NOT NULL,
                          PRIMARY KEY (`id`),
                          UNIQUE KEY `ux_ms_hh_year_month` (`household_id`,`year`,`month`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                        """
                    )
                )
                conn.commit()

            # ensure added columns exist when upgrading existing table
            for col, ddl in [
                ("total_assets", "ALTER TABLE monthly_snapshots ADD COLUMN total_assets DECIMAL(18,2) NULL"),
                ("total_liabilities", "ALTER TABLE monthly_snapshots ADD COLUMN total_liabilities DECIMAL(18,2) NULL"),
                ("net_worth", "ALTER TABLE monthly_snapshots ADD COLUMN net_worth DECIMAL(18,2) NULL"),
                ("debt_ratio", "ALTER TABLE monthly_snapshots ADD COLUMN debt_ratio DECIMAL(6,2) NULL"),
            ]:
                exists = conn.execute(
                    text(
                        """
                        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'monthly_snapshots' AND COLUMN_NAME = :col
                        """
                    ),
                    {"db": settings.db_name, "col": col},
                ).scalar() or 0
                if not exists:
                    conn.execute(text(ddl))
                    conn.commit()

            result4 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'loan_term_months'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result4.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN loan_term_months INT NULL"))
                conn.commit()

            result5 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'depreciation_rate'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result5.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN depreciation_rate DECIMAL(6,4) NULL"))
                conn.commit()

            result6 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'annual_interest_rate'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result6.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN annual_interest_rate DECIMAL(6,4) NULL"))
                conn.commit()

            # loan_start_date
            result5b = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'loan_start_date'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result5b.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN loan_start_date DATE NULL"))
                conn.commit()

            # loan_end_date
            result5c = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'loan_end_date'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result5c.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN loan_end_date DATE NULL"))
                conn.commit()

            result6 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'investment_term_months'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result6.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN investment_term_months INT NULL"))
                conn.commit()

            result7 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'monthly_income'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result7.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN monthly_income DECIMAL(18,2) NULL"))
                conn.commit()

            result8 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'invest_start_date'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result8.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN invest_start_date DATE NULL"))
                conn.commit()

            # invest_end_date
            result8b = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'invest_end_date'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result8b.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN invest_end_date DATE NULL"))
                conn.commit()

            result9 = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'depreciation_rate'
                    """
                ),
                {"db": settings.db_name},
            )
            if not (result9.scalar() or 0):
                conn.execute(text("ALTER TABLE accounts ADD COLUMN depreciation_rate DECIMAL(6,4) NULL"))
                conn.commit()

            # Tenancies: add frequency if missing
            try:
                ten_tbl_exists = conn.execute(
                    text(
                        """
                        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                        WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'tenancies'
                        """
                    ),
                    {"db": settings.db_name},
                ).scalar() or 0
                if ten_tbl_exists:
                    freq_exists = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'tenancies' AND COLUMN_NAME = 'frequency'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not freq_exists:
                        conn.execute(text("ALTER TABLE tenancies ADD COLUMN frequency VARCHAR(16) NOT NULL DEFAULT 'monthly'"))
                        conn.commit()
            except OperationalError:
                pass
            # Ensure account_value_updates.note exists
            try:
                avu_tbl_exists = conn.execute(
                    text(
                        """
                        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                        WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'account_value_updates'
                        """
                    ),
                    {"db": settings.db_name},
                ).scalar() or 0
                if avu_tbl_exists:
                    note_exists = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'account_value_updates' AND COLUMN_NAME = 'note'
                            """
                        ),
                        {"db": settings.db_name},
                    ).scalar() or 0
                    if not note_exists:
                        conn.execute(text("ALTER TABLE account_value_updates ADD COLUMN note TEXT NULL"))
                        conn.commit()
            except OperationalError:
                pass
    except Exception as e:
        print(f"Warning: Could not ensure schema upgrade: {e}")
