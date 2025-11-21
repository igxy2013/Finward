# Finward 资产负债小程序

一个参考“鲨鱼资产管家”的个人资产/负债记录方案，包含：

- 微信小程序前端（`miniapp/`）
- FastAPI + MySQL 后端（`backend/`）

## 目录结构

```
backend/        # Python FastAPI 后端
miniapp/        # 微信小程序源码
.env?           # （可选）根级配置
```

## 快速上手

1. **配置数据库**
   - 创建 `finward` 数据库与授权账号
   - 执行 `backend/sql/schema.sql`

2. **启动后端**
   - 一键脚本（推荐）：
     ```powershell
     cd backend
     copy example.env .env    # 首次使用，按需修改
     .\run_dev.bat
     ```
   - 手动方式：
     ```powershell
     cd backend
     python -m venv .venv
     .venv\Scripts\activate
     pip install -r requirements.txt
     uvicorn app.main:app --reload --port 5085
     ```

3. **运行小程序**
   - 用微信开发者工具导入 `miniapp/` 目录
   - 在 `app.js` 的 `apiBaseUrl` 中配置真实后端地址（默认指向 `http://127.0.0.1:5085`）

## 功能清单

- 资产/负债分类管理
- 记录资产/负债明细，支持金额、币种、备注
- 总览页面展示总资产、总负债、净值
- 微信小程序端可新增记录并查看分类列表

## 下一步拓展

- 资产/负债分类管理页面
- 图表可视化与趋势分析
- 多用户登录与权限
- 自动化账单导入

