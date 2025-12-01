const api = require("../../utils/api");

// 类别图标映射
const CATEGORY_ICON_MAP = {
  // 收入类别图标
  "工资": "briefcase-line.svg",
  "奖金": "coin-line.svg",
  "理财收益": "stock-line.svg",
  "分红": "hand-coin-line.svg",
  "投资回款": "money-dollar-circle-line.svg",
  "租金收入": "home-4-line.svg",
  
  // 支出类别图标
  "餐饮": "restaurant-line-red.svg",
  "交通出行": "car-line-red.svg",
  "房租": "home-4-line-red.svg",
  "物业管理": "building-line-red.svg",
  "水电网": "lightbulb-line-red.svg",
  "通讯": "phone-line-red.svg",
  "教育培训": "book-line-red.svg",
  "医疗健康": "nurse-line-red.svg",
  "娱乐休闲": "customer-service-2-line-red.svg",
  "服饰美妆": "user-line-red.svg",
  "日用品": "shopping-bag-line-red.svg",
  "借款还款": "wallet-line-red.svg",
  
  // 负债月供图标
  "房贷月供": "home-4-line-red.svg",
  "车贷月供": "car-line-red.svg",
  "信用卡月供": "bank-line-red.svg",
  "消费贷月供": "wallet-line-red.svg",
  "借款月供": "wallet-line-red.svg",
  "应付款月供": "wallet-line-red.svg",
  
  // 资产收益图标
  "资产收益": "money-dollar-circle-line.svg",
  
  // 默认图标
  "其他收入": "add-circle-line.svg",
  "其他支出": "add-circle-line-red.svg"
};

// 获取类别对应的图标
const getCategoryIcon = (category, type) => {
  // 先尝试精确匹配类别
  if (CATEGORY_ICON_MAP[category]) {
    return CATEGORY_ICON_MAP[category];
  }
  
  // 根据类型返回默认图标
  if (type === 'income') {
    return "arrow-up-s-line.svg";
  } else {
    return "arrow-down-s-line-red.svg";
  }
};

Page({
  data: {
    summary: {
      expectedExpense: "0.00",
      expectedIncome: "0.00",
      actualExpense: "0.00",
      actualIncome: "0.00"
    },
    summaryReady: false,
    typeTabs: [
      { label: "全部", value: "all" },
      { label: "收入", value: "income" },
      { label: "支出", value: "expense" }
    ],
    activeType: "all",
    cashflows: []
  },
  async onShow() {
    const app = getApp();
    try {
      const token = app?.globalData?.token || wx.getStorageSync('fw_token');
      if (token && !app?.globalData?.token) {
        app.globalData.token = token;
      }
      if (!app?.globalData?.token && typeof app?.ensureLogin === 'function') {
        await app.ensureLogin();
      }
    } catch (e) {}
    this.skipFilterOnce = true;
    this.setData({ summaryReady: false, activeType: 'all' }, () => {
      this.fetchSummary(true);
      this.fetchList(false);
    });
  },
  async fetchSummary(skipIncomeUpdate = false) {
    const now = new Date();
    const sel = 'month';
    const end = this.formatDate(now);
    const start = this.formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
    try {
      const res = await api.fetchWealthSummary(start, end, sel);
      
      let designServiceIncome = 0;
      try {
        const stats = await api.getFinanceStats('month');
        if (stats.success) {
          designServiceIncome = Number(stats.data.total_revenue || 0);
        }
      } catch (err) {}
      
      let expectedRentIncomeSum = 0;
      let assetMonthlyIncomeSum = 0;
      try {
        const primaryDays = 45;
        let reminders = [];
        let assets = [];
        try {
          const res = await Promise.all([
            api.listRentReminders(primaryDays),
            api.listAccounts("asset")
          ]);
          reminders = res[0] || [];
          assets = res[1] || [];
        } catch (err1) {
          try {
            const res2 = await Promise.all([
              api.listRentReminders(45),
              api.listAccounts("asset")
            ]);
            reminders = res2[0] || [];
            assets = res2[1] || [];
          } catch (err2) {
            try {
              assets = await api.listAccounts("asset");
              reminders = [];
            } catch (err3) {
              assets = [];
              reminders = [];
            }
          }
        }
        const rangeStart = start ? new Date(String(start).replace(/-/g, "/")) : null;
        const rangeEnd = end ? new Date(String(end).replace(/-/g, "/")) : null;
        const inRange = (ds) => {
          if (!rangeStart || !rangeEnd) return true;
          const d = new Date(String(ds).replace(/-/g, "/"));
          return d >= rangeStart && d <= rangeEnd;
        };
        const rentedAssetIds = new Set();
        (reminders || []).forEach((r) => {
          if (inRange(r.next_due_date)) {
            expectedRentIncomeSum += Number(r.monthly_rent || 0);
            if (r.account_id) rentedAssetIds.add(Number(r.account_id));
          }
        });
        (assets || []).forEach((acc) => {
          if (!rentedAssetIds.has(Number(acc.id))) {
            const mi = Number(acc.monthly_income || 0);
            if (mi > 0) assetMonthlyIncomeSum += mi;
          }
        });
      } catch (err) {}

      let plannedIncomeSum = 0;
      try {
        const query = { end };
        if (start) query.start = start;
        const cfList = await api.listCashflows(query);
        plannedIncomeSum = (cfList || []).reduce((sum, x) => sum + (x && x.type === 'income' && !!x.planned ? Number(x.amount || 0) : 0), 0);
      } catch (err) {}

      const expectedIncomeVal = skipIncomeUpdate ? this.data.summary.expectedIncome : this.formatNumber(plannedIncomeSum + expectedRentIncomeSum + assetMonthlyIncomeSum + designServiceIncome);
      const actualIncomeVal = skipIncomeUpdate ? this.data.summary.actualIncome : this.formatNumber(Number(res.actual_income));
      this.setData({
        summary: {
          expectedExpense: this.formatNumber(res.expected_expense),
          expectedIncome: expectedIncomeVal,
          actualExpense: this.formatNumber(res.actual_expense),
          actualIncome: actualIncomeVal
        },
        summaryReady: !skipIncomeUpdate ? true : this.data.summaryReady
      });
    } catch (e) {
      // 游客模式下不显示演示数据
      this.setData({
        summary: {
          expectedExpense: this.formatNumber(0),
          expectedIncome: this.formatNumber(0),
          actualExpense: this.formatNumber(0),
          actualIncome: this.formatNumber(0)
        }
      });
    }
  },
  async fetchList(skipSummary = false, forceAll = false) {
    const sel = 'month';
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    const query = { end };
    if (start) query.start = start;
    if (!forceAll && !this.skipFilterOnce && this.data.activeType !== "all") query.type = this.data.activeType;
    try {
      let list = [];
      try {
        list = await api.listCashflows(query);
      } catch (e0) {
        list = [];
      }
      let plannedList = [];
      let plannedExpenseList = [];
      try {
        plannedList = await api.listCashflows({ ...query, planned: true });
      } catch (e) {}
      try {
        plannedExpenseList = await api.listCashflows({ ...query, planned: true, type: 'expense' });
      } catch (e2) {}
      const normalized = (arr) => (arr || []).map((x) => ({ ...x, id: x.id || `${x.type || 'unknown'}:${x.planned ? 'planned' : 'actual'}:${x.category}:${x.date}` }));
      const mergedRaw = [...normalized(list), ...normalized(plannedList), ...normalized(plannedExpenseList)];
      const formatted = mergedRaw.map((x) => ({
        ...x,
        amount: this.formatNumber(x.amount),
        name: x.note ? x.note : x.category,
        icon: getCategoryIcon(x.category, x.type)
      }));
      let rents = [];
      try {
        const [reminders, assets] = await Promise.all([
          api.listRentReminders(90),
          api.listAccounts("asset"),
        ]);
        const assetNameMap = Object.create(null);
        (assets || []).forEach((a) => { assetNameMap[Number(a.id)] = a.name; });
        rents = (reminders || []).map((r) => ({
          id: `tenancy:${r.tenancy_id}`,
          type: 'income',
          category: '租金收入',
          amount: this.formatNumber(r.monthly_rent),
          date: r.next_due_date,
          planned: true,
          recurring_monthly: false,
          _synthetic: 'rent',
          tenancy_id: r.tenancy_id,
          account_id: r.account_id,
          account_name: assetNameMap[Number(r.account_id)] || undefined,
          name: assetNameMap[Number(r.account_id)] ? `${assetNameMap[Number(r.account_id)]}租金` : '租金收入',
          tenant_name: r.tenant_name, // 添加租户名称
          icon: getCategoryIcon('租金收入', 'income')
        }));
      } catch (err) {}
      
      // 获取资产月收益（排除已计算为租金收入的资产）
      let assetIncomes = [];
      try {
        const assets = await api.listAccounts("asset");
        
        // 创建已计算为租金收入的资产ID集合
        const rentedAssetIds = new Set();
        rents.forEach(rent => {
          if (rent.account_id) {
            rentedAssetIds.add(rent.account_id);
          }
        });
        
        assets.forEach((acc) => {
          // 跳过已计算为租金收入的资产
          if (rentedAssetIds.has(acc.id)) {
            return;
          }
          
          // 检查资产是否有月收益
          if (acc.monthly_income && Number(acc.monthly_income) > 0) {
            assetIncomes.push({
              id: `asset-income:${acc.id}`,
              type: 'income',
              category: acc.category || '资产收益',
              amount: this.formatNumber(acc.monthly_income),
              date: end, // 使用当前日期
              planned: true,
              recurring_monthly: true,
              _synthetic: 'asset-income',
              account_id: acc.id,
              account_name: acc.name,
              name: acc.name ? `${acc.name}收益` : '资产收益',
              icon: getCategoryIcon(acc.category || '资产收益', 'income')
            });
          }
        });
      } catch (err) {
        console.error('获取资产收益失败:', err);
      }
      
      let debts = [];
      try {
        let liabilities = [];
        try {
          liabilities = await api.listAccounts("liability");
          if (Array.isArray(liabilities) && liabilities.length > 0) {
            try { wx.setStorageSync('fw_liabilities_cache', liabilities); } catch (e) {}
          }
        } catch (errFetch) {
          try {
            const cached = wx.getStorageSync('fw_liabilities_cache');
            if (Array.isArray(cached) && cached.length > 0) {
              liabilities = cached;
            } else {
              liabilities = [];
            }
          } catch (e) {
            liabilities = [];
          }
        }
        const rangeStart = start ? new Date(String(start).replace(/-/g, "/")) : null;
        const rangeEnd = end ? new Date(String(end).replace(/-/g, "/")) : null;
        const clampDay = (yy, mm, dd) => {
          const daysInMonth = new Date(yy, mm, 0).getDate();
          return Math.max(1, Math.min(daysInMonth, Number(dd) || 1));
        };
        const pushPayment = (acc, y, m, d) => {
          const dt = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          debts.push({
            id: `loan:${acc.id}:${y}${String(m).padStart(2, "0")}`,
            type: 'expense',
            category: (acc.category || '负债') + '月供',
            amount: this.formatNumber(acc.monthly_payment),
            date: dt,
            planned: true,
            recurring_monthly: true,
            _synthetic: 'loan',
            account_id: acc.id,
            account_name: acc.name,
            name: acc.name ? `${acc.name}月供` : ((acc.category || '负债') + '月供'),
            icon: getCategoryIcon((acc.category || '负债') + '月供', 'expense')
          });
        };
        liabilities.forEach((acc) => {
          const mp = Number(acc.monthly_payment || 0);
          const startStr = acc.loan_start_date;
          const term = Number(acc.loan_term_months || 0);
          if (!mp) return;
          if (!startStr) {
            if (!rangeStart || !rangeEnd) return;
            const y = rangeStart.getFullYear();
            const m = rangeStart.getMonth() + 1;
            const d = clampDay(y, m, 1);
            pushPayment(acc, y, m, d);
            return;
          }
          const s = new Date(String(startStr).replace(/-/g, "/"));
          const dueDay = s.getDate();
          if (sel === 'all') {
            const today = new Date();
            let y = today.getFullYear();
            let m = today.getMonth() + 1;
            let d = clampDay(y, m, dueDay);
            let candidate = new Date(y, m - 1, d);
            if (candidate < today) {
              m += 1; if (m > 12) { m = 1; y += 1; }
              d = clampDay(y, m, dueDay);
              candidate = new Date(y, m - 1, d);
            }
            if (candidate >= s) pushPayment(acc, candidate.getFullYear(), candidate.getMonth() + 1, candidate.getDate());
          } else {
            if (!rangeStart || !rangeEnd) return;
            let y = rangeStart.getFullYear();
            let m = rangeStart.getMonth() + 1;
            let maxMonths = term > 0 ? term : 600;
            let count = 0;
            while (true) {
              const d = clampDay(y, m, dueDay);
              const cand = new Date(y, m - 1, d);
              if (cand < s) {
                m += 1; if (m > 12) { m = 1; y += 1; }
                count += 1; if (count >= maxMonths) break;
                continue;
              }
              if (cand > rangeEnd) break;
              if (cand >= rangeStart && cand <= rangeEnd) {
                pushPayment(acc, y, m, d);
              }
              m += 1; if (m > 12) { m = 1; y += 1; }
              count += 1; if (count >= maxMonths) break;
            }
          }
        });
      } catch (err) {}
      
      // 获取财务统计数据并添加为设计服务收入
      let designServiceIncome = [];
      try {
        // 只在本月视图下添加设计服务收入
        if (sel === 'month') {
          const stats = await api.getFinanceStats('month');
          if (stats.success && stats.data.total_revenue > 0) {
            designServiceIncome = [{
              id: 'design-service-income',
              type: 'income',
              category: '其他收入',
              amount: this.formatNumber(stats.data.total_revenue),
              date: end,
              planned: true,
              recurring_monthly: false,
              _synthetic: 'design-service',
              name: '设计服务',
              note: '设计服务收入',
              icon: getCategoryIcon('其他收入', 'income')
            }];
          }
        }
      } catch (err) {
        console.error('获取设计服务收入失败:', err);
      }
      const activeType = this.data.activeType;

      let expectedExpenseFallback = [];
      try {
        const plannedExpenseCount = mergedRaw.filter(x => x && x.type === 'expense' && !!x.planned).length + (debts || []).length;
        const toNum = (s) => {
          const n = Number(String(s).replace(/,/g, ''));
          return Number.isNaN(n) ? 0 : n;
        };
        const expectedExpNum = toNum(this.data.summary.expectedExpense);
        if (plannedExpenseCount === 0 && expectedExpNum > 0) {
          expectedExpenseFallback = [{
            id: 'expected-expense-total',
            type: 'expense',
            category: '预计支出',
            amount: this.formatNumber(expectedExpNum),
            date: end,
            planned: true,
            recurring_monthly: false,
            _synthetic: 'expected-expense-total',
            name: '本月预计支出合计',
            icon: getCategoryIcon('其他支出', 'expense')
          }];
        }
      } catch (e) {}

      const combinedAll = [...rents, ...assetIncomes, ...debts, ...formatted, ...designServiceIncome, ...expectedExpenseFallback]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map(item => ({
          ...item,
          icon: item.icon || getCategoryIcon(item.category, item.type)
        }));
      let combined = (forceAll || this.skipFilterOnce) ? combinedAll : combinedAll.filter((x) => activeType === 'all' || x.type === activeType);
      if (activeType !== 'all' && combined.length === 0 && combinedAll.length > 0) {
        combined = combinedAll;
      }
      this.setData({ cashflows: combined });
      this.skipFilterOnce = false;

      // 用全部记录重算预计/实际收入，确保与列表来源一致但不受过滤影响
      if (!skipSummary) {
        const toNum = (s) => {
          const n = Number(String(s).replace(/,/g, ''));
          return Number.isNaN(n) ? 0 : n;
        };
        const totalExpectedIncome = combinedAll
          .filter(i => i.type === 'income' && !!i.planned)
          .reduce((sum, i) => sum + toNum(i.amount), 0);
        const totalActualIncome = combinedAll
          .filter(i => i.type === 'income' && !i.planned)
          .reduce((sum, i) => sum + toNum(i.amount), 0);
        this.setData({
          summary: {
            ...this.data.summary,
            expectedIncome: this.formatNumber(totalExpectedIncome),
            actualIncome: this.formatNumber(totalActualIncome)
          },
          summaryReady: true
        });
      }

      // 汇总数值仅在 fetchSummary 中计算，这里不覆盖以避免受过滤器影响

      
    } catch (e) {
      // 游客模式下不显示演示数据
      this.setData({ cashflows: [] });
    }
  },
  handleTypeTab(e) {
    const val = String(e.currentTarget.dataset.value || "all");
    if (val === this.data.activeType) return;
    this.setData({ activeType: val }, () => this.fetchList(true));
  },
  openCashflowActions(e) {
    const rawId = String(e.currentTarget.dataset.id || "");
    if (!rawId) return;
    if (rawId.startsWith('tenancy:')) {
      const tenancyId = Number(rawId.split(':')[1] || 0);
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      const accountId = item?.account_id || 0;
      wx.navigateTo({ url: `/pages/manage/index?edit=1&id=${accountId}&tenancy_id=${tenancyId}` });
      return;
    }
    if (rawId.startsWith('loan:')) {
      const parts = rawId.split(':');
      const accountId = Number(parts[1] || 0);
      if (accountId) wx.navigateTo({ url: `/pages/manage/index?edit=1&id=${accountId}` });
      return;
    }
    
    // 处理资产收益点击事件
    if (rawId.startsWith('asset-income:')) {
      const parts = rawId.split(':');
      const accountId = Number(parts[2] || 0);
      if (accountId) wx.navigateTo({ url: `/pages/assets/index?edit=1&id=${accountId}` });
      return;
    }
    
    const id = Number(rawId);
    if (!id) return;
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: (res) => {
        if (res.tapIndex === 0) this.editCashflow(id);
        if (res.tapIndex === 1) this.deleteCashflow(id);
      }
    });
  },
  editCashflow(id) {
    wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
  },
  viewCashflow(e) {
    const rawId = String(e.currentTarget.dataset.id || "");
    if (!rawId) return;
    if (rawId.startsWith('tenancy:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
        const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&tenant_name=${encodeURIComponent(String(item.tenant_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    if (rawId.startsWith('loan:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
        const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    
    if (rawId.startsWith('asset-income:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
        const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    
    const id = Number(rawId);
    if (!id) return;
    wx.navigateTo({ url: `/pages/cashflow-detail/index?id=${id}` });
  },
  async deleteCashflow(id) {
    wx.showModal({
      title: "删除确认",
      content: "确定删除该记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteCashflow(id);
          wx.showToast({ title: "已删除", icon: "success" });
          this.fetchSummary();
          this.fetchList();
        } catch (e) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  },
  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  },
  formatNumber(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return "0.00";
    return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  goToManageIncome() {
    wx.navigateTo({ url: "/pages/manage/index" });
  },
  goToManageExpense() {
    wx.navigateTo({ url: "/pages/manage/index" });
  },
  goToCashflowManage() {
    wx.navigateTo({ url: "/pages/cashflow/index" });
  }
});
