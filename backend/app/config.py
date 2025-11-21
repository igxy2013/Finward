from functools import lru_cache
from typing import Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "finward"
    db_user: str = "root"
    db_password: str = ""
    db_echo: bool = False
    allowed_origins: Union[str, list[str]] = ["*"]
    wx_app_id: str = ""
    wx_app_secret: str = ""
    wechat_app_id: str = ""
    wechat_app_secret: str = ""

    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v):
        """Parse comma-separated string or list to list"""
        if isinstance(v, str):
            # Handle comma-separated string
            if v.strip() == "":
                return ["*"]
            # Split by comma and strip whitespace
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # Ignore extra fields in .env file
    )

    @property
    def sqlalchemy_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )
    
    @property
    def sqlalchemy_url_no_db(self) -> str:
        """Connection URL without database name, for creating database"""
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}"
        )

    @property
    def effective_wx_app_id(self) -> str:
        return self.wx_app_id or self.wechat_app_id

    @property
    def effective_wx_app_secret(self) -> str:
        return self.wx_app_secret or self.wechat_app_secret


@lru_cache
def get_settings() -> Settings:
    return Settings()



