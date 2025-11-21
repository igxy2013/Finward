# 资产负债小程序后端

基于 FastAPI + SQLAlchemy + MySQL 的后端，为微信小程序提供资产/负债记录、分类与概览统计接口。

## 运行环境

- Python 3.11+
- MySQL 8.0+

## 快速开始

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

复制 `.env.example` 为 `.env` 并填入数据库连接信息。

```bash
uvicorn app.main:app --reload
```

## 数据表初始化

```bash
mysql -u <user> -p < db_name> < sql/schema.sql
```

## API 概览

- `GET /ping` 健康检查
- `GET /accounts?type=asset|liability`
- `POST /accounts`
- `PATCH /accounts/{account_id}`
- `DELETE /accounts/{account_id}`
- `GET /overview` 汇总总资产、总负债与净值

详细参数见对应 `routers` 模块。



