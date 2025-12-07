const api = require("../../utils/api");

// 资产类别图标映射
const ASSET_CATEGORY_ICONS = {
  "现金": "wallet-3-line.svg",
  "储蓄卡": "bank-line.svg",
  "活期": "wallet-2-line.svg",
  "定期": "calendar-line.svg",
  "基金": "stock-line.svg",
  "股票": "line-chart-line.svg",
  "理财": "hand-coin-line.svg",
  "房产": "home-4-line.svg",
  "车辆": "car-line.svg",
  "应收款": "money-cny-circle-line.svg",
  "光伏发电站": "building-line.svg",
  "新能源充电站": "building-line.svg",
  "对外投资": "building-line.svg",
  "其他": "wallet-line.svg"
};

// 负债类别图标映射
const LIABILITY_CATEGORY_ICONS = {
  "信用卡": "bank-line-red.svg",
  "消费贷": "wallet-line-red.svg",
  "房贷": "home-4-line-red.svg",
  "车贷": "car-line-red.svg",
  "借款": "money-cny-circle-line-red.svg",
  "应付款": "bill-line-red.svg",
  "其他": "wallet-line-red.svg"
};

// 获取资产类别图标
const getAssetCategoryIcon = (category) => {
  return ASSET_CATEGORY_ICONS[category] || "wallet-3-line.svg";
};

// 获取负债类别图标
const getLiabilityCategoryIcon = (category) => {
  return LIABILITY_CATEGORY_ICONS[category] || "bill-line.svg";
};

const normalizeAssetCategory = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "其他";
  if (/(新能源)?充电站|光伏(发电站)?/i.test(s)) return "对外投资";
  return s;
};

 

Page({
  data: {
    loading: true,
    error: "",
    needLogin: false,
    loggingIn: false,
    summary: {
      netWorth: "0.00",
      totalAssets: "0.00",
      totalLiabilities: "0.00",
      netChange: "0.00",
      changeRatio: "0.00%",
      changeRatioValue: 0,
      debtRatio: "0.00%",
      debtRatioValue: 0
    },
    trend: [],
    monthly: [],
    monthlyValueW: 0,
    monthlyValueH: 0,
    monthlyRatioW: 0,
    monthlyRatioH: 0,
    assetCategories: [],
    liabilityCategories: [],
    cashflow: [],
    incomeChartData: [],
    expenseChartData: [],
    incomeTrendSeries: [],
    expenseTrendSeries: [],
    incomeTrendLabels: [],
    expenseTrendLabels: [],
    highlights: {
      bestCategory: "-",
      bestCategoryAmount: "0.00",
      riskCategory: "-",
      riskCategoryAmount: "0.00"
    }
  },
  openCategoryDetail(e) {
    const type = String(e.currentTarget.dataset.type || "");
    const category = String(e.currentTarget.dataset.category || "");
    const target = type === 'asset' ? '/pages/assets/index' : '/pages/liabilities/index';
    const url = `${target}?category=${encodeURIComponent(category)}`;
    wx.navigateTo({ url });
  },
 
  onLoad() {
    const app = getApp();
    const token = app?.globalData?.token || wx.getStorageSync('fw_token');
    if (!token) {
      app.globalData.guest = true;
    } else {
      app.globalData.guest = false;
      if (!app.globalData.token) app.globalData.token = token;
    }
    this.setData({ needLogin: false });
    if (app.globalData.guest) {
      this.setData({
        loading: false,
        summary: {
          netWorth: this.formatNumber(0),
          totalAssets: this.formatNumber(0),
          totalLiabilities: this.formatNumber(0),
          netChange: this.formatSignedNumber(0),
          changeRatio: "0%",
          changeRatioValue: 0,
          debtRatio: "0%",
          debtRatioValue: 0
        },
        trend: [],
        assetCategories: [],
        liabilityCategories: [],
        cashflow: [],
        monthly: [],
        incomeChartData: [],
        expenseChartData: [],
        highlights: {
          bestCategory: "-",
          bestCategoryAmount: "￥0.00",
          riskCategory: "-",
          riskCategoryAmount: "￥0.00"
        }
      });
      return;
    }
    this.fetchAnalytics();
  },
  onShow() {
    const app = getApp();
    const token = app?.globalData?.token || wx.getStorageSync('fw_token');
    if (!token) {
      app.globalData.guest = true;
    } else {
      app.globalData.guest = false;
      if (!app.globalData.token) app.globalData.token = token;
    }
    if (this.data.needLogin) this.setData({ needLogin: false });
    if (app.globalData.guest) {
      this.setData({
        loading: false,
        summary: {
          netWorth: this.formatNumber(0),
          totalAssets: this.formatNumber(0),
          totalLiabilities: this.formatNumber(0),
          netChange: this.formatSignedNumber(0),
          changeRatio: "0%",
          changeRatioValue: 0,
          debtRatio: "0%",
          debtRatioValue: 0
        },
        trend: [],
        assetCategories: [],
        liabilityCategories: [],
        cashflow: [],
        monthly: [],
        incomeChartData: [],
        expenseChartData: [],
        highlights: {
          bestCategory: "-",
          bestCategoryAmount: "￥0.00",
          riskCategory: "-",
          riskCategoryAmount: "￥0.00"
        }
      });
      return;
    }
    this.fetchAnalytics(true);
  },

  async fetchAnalytics(quiet = false) {
    const app = getApp();
    if (!app?.globalData?.token || app.globalData.guest) {
      this.setData({
        loading: false,
        summary: {
          netWorth: this.formatNumber(0),
          totalAssets: this.formatNumber(0),
          totalLiabilities: this.formatNumber(0),
          netChange: this.formatSignedNumber(0),
          changeRatio: "0%",
          changeRatioValue: 0,
          debtRatio: "0%",
          debtRatioValue: 0
        },
        trend: [],
        assetCategories: [],
        liabilityCategories: [],
        cashflow: [],
        monthly: [],
        incomeChartData: [],
        expenseChartData: [],
        highlights: {
          bestCategory: "-",
          bestCategoryAmount: "￥0.00",
          riskCategory: "-",
          riskCategoryAmount: "￥0.00"
        }
      });
      return;
    }
    const days = 365;
    this.setData({ loading: !quiet, error: "" });
    try {
      const res = await api.fetchAnalytics(days);
      const summary = this.formatSummary(res.summary || {});
      const assetCategories = this.prepareCategories(res.asset_categories || [], "asset");
      const liabilityCategories = this.prepareCategories(res.liability_categories || [], "liability");
      const highlights = this.formatHighlights(res.highlights || {});
      this.setData(
        {
          loading: false,
          summary,
          trend: res.trend || [],
          assetCategories,
          liabilityCategories,
          cashflow: res.cashflow || [],
          highlights
        },
        () => {
          this.drawTrendChart();
          this.drawCashflowChart();
          this.fetchStats(12);
        }
      );
      try {
        const monthlyRes = await api.fetchMonthlyAnalytics(12);
        this.setData({ monthly: monthlyRes.points || [] }, () => {
          this.drawMonthlyCharts();
        });
      } catch (e2) {
        this.setData({ monthly: [] }, () => { this.drawMonthlyCharts(); });
      }
    } catch (error) {
      // 游客模式下不显示演示数据
      this.setData({
        loading: false,
        summary: {
          netWorth: this.formatNumber(0),
          totalAssets: this.formatNumber(0),
          totalLiabilities: this.formatNumber(0),
          netChange: this.formatSignedNumber(0),
          changeRatio: "0%",
          changeRatioValue: 0,
          debtRatio: "0%",
          debtRatioValue: 0
        },
        trend: [],
        assetCategories: [],
        liabilityCategories: [],
        cashflow: [],
        monthly: [],
        highlights: {
          bestCategory: "-",
          bestCategoryAmount: "￥0.00",
          riskCategory: "-",
          riskCategoryAmount: "￥0.00"
        },
        error: ""
      });
    }
  },
  async fetchStats(months = 12) {
    const app = getApp();
    if (!app?.globalData?.token || app.globalData.guest) {
      this.setData({ incomeChartData: [], expenseChartData: [], incomeTrendSeries: [], expenseTrendSeries: [], incomeTrendLabels: [] });
      return;
    }
    try {
      const stats = await api.fetchStats(months);
      const decorate = (slices = [], kind = 'income') => {
        const paletteIncome = ["#43B176", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#22c55e"];
        const paletteExpense = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4"];
        const palette = kind === 'income' ? paletteIncome : paletteExpense;
        return (slices || []).map((it, idx) => ({ name: it.category, value: Number(it.amount || 0), percentage: Number(it.percentage || 0).toFixed(1), color: palette[idx % palette.length] }));
      };
      const incomeChartData = decorate(stats.income_distribution || [], 'income');
      const expenseChartData = decorate(stats.expense_distribution || [], 'expense');
      const labels = Array.isArray(stats.labels) ? stats.labels : [];
      const monthLabels = labels.map(l => this.getMonthLabel(l));
      const incomeSeries = Array.isArray(stats.income_trend) ? stats.income_trend.map(n => Number(n || 0)) : [];
      const expenseSeries = Array.isArray(stats.expense_trend) ? stats.expense_trend.map(n => Number(n || 0)) : [];
      this.setData({ incomeChartData, expenseChartData, incomeTrendLabels: monthLabels, expenseTrendLabels: monthLabels, incomeTrendSeries: incomeSeries, expenseTrendSeries: expenseSeries }, () => {
        this.drawIncomePie();
        this.drawExpensePie();
        this.drawIncomeTrend();
        this.drawIncomeExpenseRatioTrend();
      });
    } catch (e) {
      this.setData({ incomeChartData: [], expenseChartData: [], incomeTrendSeries: [], expenseTrendSeries: [], incomeTrendLabels: [] });
    }
  },
  async fetchCashflowDistribution() {
    const app = getApp();
    if (!app?.globalData?.token || app.globalData.guest) {
      this.setData({ incomeChartData: [], expenseChartData: [] });
      return;
    }
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const start = this.formatDate(startDate);
      const end = this.formatDate(endDate);
      const query = { start, end };
      let list = [];
      try { list = await api.listCashflows(query); } catch (e) { list = []; }

      const rangeStart = start ? new Date(String(start).trim().replace(/-/g, "/")) : null;
      const rangeEnd = end ? new Date(String(end).trim().replace(/-/g, "/")) : null;
      const inRange = (ds) => {
        if (!rangeStart || !rangeEnd) return true;
        const d = new Date(String(ds).trim().replace(/-/g, "/"));
        if (isNaN(d.getTime())) return false;
        return d >= rangeStart && d <= rangeEnd;
      };

      let rents = [];
      let assets = [];
      try {
        const res = await Promise.all([
          api.listRentReminders(90),
          api.listAccounts("asset")
        ]);
        const reminders = res[0] || [];
        assets = res[1] || [];
        const assetNameMap = Object.create(null);
        (assets || []).forEach((a) => { assetNameMap[Number(a.id)] = a.name; });
        rents = (reminders || []).filter(r => inRange(r.next_due_date)).map((r) => ({
          id: `tenancy:${r.tenancy_id}`,
          type: 'income',
          category: '租金收入',
          amount: Number(r.monthly_rent || 0),
          date: r.next_due_date,
          planned: true
        }));
      } catch (err) { rents = []; }

      let assetIncomes = [];
      try {
        const rentedIds = new Set();
        (rents || []).forEach(r => { if (r.account_id) rentedIds.add(Number(r.account_id)); });
        (assets || []).forEach((acc) => {
          const mi = Number(acc.monthly_income || 0);
          if (!(mi > 0)) return;
          const investEndStr = acc.invest_end_date;
          if (investEndStr) {
            const e = new Date(String(investEndStr).trim().replace(/-/g, "/"));
            if (!isNaN(e.getTime())) {
              const endIdx = e.getFullYear() * 12 + (e.getMonth() + 1);
              const curIdx = endDate.getFullYear() * 12 + (endDate.getMonth() + 1);
              if (curIdx > endIdx) return;
            }
          }
          assetIncomes.push({
            id: `asset-income:${acc.id}`,
            type: 'income',
            category: acc.category || '资产收益',
            amount: mi,
            date: end,
            planned: true
          });
        });
      } catch (err) { assetIncomes = []; }

      let debts = [];
      try {
        const liabilities = await api.listAccounts("liability");
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
            amount: Number(acc.monthly_payment || 0),
            date: dt,
            planned: true
          });
        };
        liabilities.forEach((acc) => {
          const mp = Number(acc.monthly_payment || 0);
          const startStr = acc.loan_start_date;
          if (!mp) return;
          if (!rangeStart || !rangeEnd) return;
          if (!startStr) {
            const y = rangeStart.getFullYear();
            const m = rangeStart.getMonth() + 1;
            const d = clampDay(y, m, 1);
            const loanEndStr = acc.loan_end_date;
            if (loanEndStr) {
              const e = new Date(String(loanEndStr).trim().replace(/-/g, "/"));
              if (!isNaN(e.getTime())) {
                const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
                const mi = y * 12 + m;
                if (mi > ei) return;
              }
            }
            pushPayment(acc, y, m, d);
            return;
          }
          const s = new Date(String(startStr).trim().replace(/-/g, "/"));
          if (isNaN(s.getTime())) return;
          const dueDay = s.getDate();
          const term = Number(acc.loan_term_months || 0);
          const loanEndStr = acc.loan_end_date;
          let y = rangeStart.getFullYear();
          let m = rangeStart.getMonth() + 1;
          while (true) {
            const d = clampDay(y, m, dueDay);
            const cand = new Date(y, m - 1, d);
            if (cand < s) { m += 1; if (m > 12) { m = 1; y += 1; } continue; }
            if (cand > rangeEnd) break;
            if (loanEndStr) {
              const e = new Date(String(loanEndStr).trim().replace(/-/g, "/"));
              if (!isNaN(e.getTime()) && cand > e) break;
            }
            const monthsElapsed = (y - s.getFullYear()) * 12 + (m - (s.getMonth() + 1));
            if (term > 0 && monthsElapsed >= term) break;
            if (cand >= rangeStart && cand <= rangeEnd) pushPayment(acc, y, m, d);
            m += 1; if (m > 12) { m = 1; y += 1; }
          }
        });
      } catch (err) { debts = []; }

      let designServiceIncome = [];
      try {
        let cached = null;
        try { cached = wx.getStorageSync('fw_design_service_stats_month'); } catch (e) { cached = null; }
        const fresh = cached && cached.data && cached.data.success && (Date.now() - (cached.ts || 0) < 5 * 60 * 1000);
        let total = 0;
        if (fresh) {
          total = Number(cached.data.data?.total_revenue || 0);
        } else {
          const stats = await api.getFinanceStats('month');
          if (stats.success) total = Number(stats.data.total_revenue || 0);
          try { wx.setStorageSync('fw_design_service_stats_month', { data: stats, ts: Date.now() }); } catch (e) {}
        }
        if (total > 0) {
          designServiceIncome = [{ id: 'design-service', type: 'income', category: '设计服务', amount: total, date: end, planned: true }];
        }
      } catch (err) { designServiceIncome = []; }

      let recurringSynth = [];
      try {
        const prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        const prevStart = this.formatDate(prevStartDate);
        const prevEnd = this.formatDate(prevEndDate);
        const prevQuery = { start: prevStart, end: prevEnd, type: 'income', planned: true };
        let prevList = [];
        try { prevList = await api.listCashflows(prevQuery); } catch (ePrev) { prevList = []; }
        const currKeys = new Set((list || [])
          .filter(i => i.type === 'income' && !!i.planned && !!i.recurring_monthly)
          .map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
        (prevList || [])
          .filter(i => i && i.type === 'income' && !!i.planned && !!i.recurring_monthly)
          .forEach(t => {
            const key = `${t.type}:${t.category}:${t.note ? t.note : t.category}`;
            if (!currKeys.has(key)) {
              const prevDay = (() => { const d = new Date(String(t.date).replace(/-/g, '/')); return d.getDate(); })();
              const y = endDate.getFullYear();
              const m = endDate.getMonth() + 1;
              const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, prevDay)); })();
              const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
              const dtObj = new Date(y, m - 1, dnum);
              const rsd = t.recurring_start_date ? new Date(String(t.recurring_start_date).replace(/-/g, '/')) : null;
              const red = t.recurring_end_date ? new Date(String(t.recurring_end_date).replace(/-/g, '/')) : null;
              if (rsd && !isNaN(rsd.getTime()) && dtObj < rsd) return;
              if (red && !isNaN(red.getTime()) && dtObj > red) return;
              recurringSynth.push({ id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`, type: 'income', category: t.category || '其他收入', amount: Number(t.amount || 0), date: dt, planned: true });
            }
          });
      } catch (e) { recurringSynth = []; }

      let recurringSynthExpense = [];
      try {
        const prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        const prevStart = this.formatDate(prevStartDate);
        const prevEnd = this.formatDate(prevEndDate);
        const prevQuery = { start: prevStart, end: prevEnd, type: 'expense', planned: true };
        let prevList = [];
        try { prevList = await api.listCashflows(prevQuery); } catch (ePrev) { prevList = []; }
        const currKeys = new Set((list || [])
          .filter(i => i.type === 'expense' && !!i.planned && !!i.recurring_monthly)
          .map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
        (prevList || [])
          .filter(i => i && i.type === 'expense' && !!i.planned && !!i.recurring_monthly)
          .forEach(t => {
            const key = `${t.type}:${t.category}:${t.note ? t.note : t.category}`;
            if (!currKeys.has(key)) {
              const prevDay = (() => { const d = new Date(String(t.date).replace(/-/g, '/')); return d.getDate(); })();
              const y = endDate.getFullYear();
              const m = endDate.getMonth() + 1;
              const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, prevDay)); })();
              const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
              const dtObj = new Date(y, m - 1, dnum);
              const rsd = t.recurring_start_date ? new Date(String(t.recurring_start_date).replace(/-/g, '/')) : null;
              const red = t.recurring_end_date ? new Date(String(t.recurring_end_date).replace(/-/g, '/')) : null;
              if (rsd && !isNaN(rsd.getTime()) && dtObj < rsd) return;
              if (red && !isNaN(red.getTime()) && dtObj > red) return;
              recurringSynthExpense.push({ id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`, type: 'expense', category: t.category || '其他支出', amount: Number(t.amount || 0), date: dt, planned: true });
            }
          });
      } catch (e) { recurringSynthExpense = []; }

      const recorded = (list || []).map(x => ({ type: x.type, category: x.category, note: x.note, amount: Number(x.amount || 0), planned: !!x.planned }));
      const combinedAll = [...recorded, ...rents, ...assetIncomes, ...debts, ...designServiceIncome, ...recurringSynth, ...recurringSynthExpense];
      const incomeItems = combinedAll.filter(i => i.type === 'income');
      const expenseItems = combinedAll.filter(i => i.type === 'expense' && i.planned);
      const incomeChartData = this.calculateCashflowDistribution(incomeItems, 'income');
      const expenseChartData = this.calculateCashflowDistribution(expenseItems, 'expense');
      this.setData({ incomeChartData, expenseChartData }, () => { this.drawIncomePie(); this.drawExpensePie(); });
    } catch (e) {
      this.setData({ incomeChartData: [], expenseChartData: [] });
    }
  },
  async updateIncomeExpenseTrends() {
    const months = this.data.monthly || [];
    if (!months || months.length === 0) return;
    let globalStart = null;
    let globalEnd = null;
    try {
      const ys = months.map(p => (String(p.month || '').split('-')[0] || '0')).map(s => parseInt(s || '0')).filter(n => !!n);
      const ms = months.map(p => (String(p.month || '').split('-')[1] || '0')).map(s => parseInt(s || '0')).filter(n => !!n);
      if (ys.length && ms.length) {
        const minY = Math.min(...ys);
        const minM = Math.min(...ms);
        const maxY = Math.max(...ys);
        const maxM = Math.max(...ms);
        const startDate = new Date(minY, minM - 1, 1);
        const endDate = new Date(maxY, maxM, 0);
        globalStart = this.formatDate(startDate);
        globalEnd = this.formatDate(endDate);
      }
    } catch (eG) { globalStart = null; globalEnd = null; }

    // 获取租金提醒，用于计算租金收入（与收支页面逻辑对齐）
    let rentReminders = [];
    try {
      rentReminders = await api.listRentReminders(90);
    } catch (e) { rentReminders = []; }
    const rentedAssetIds = new Set();
    (rentReminders || []).forEach(r => {
      if (r.account_id) rentedAssetIds.add(Number(r.account_id));
    });

    const buildRange = (monthStr) => {
      const parts = String(monthStr || '').split('-');
      const y = parseInt(parts[0] || '0');
      const m = parseInt(parts[1] || '0');
      if (!y || !m) return null;
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0);
      return { start: this.formatDate(startDate), end: this.formatDate(endDate), y, m };
    };
      const tasks = months.map(p => {
        const rng = buildRange(p.month);
        if (!rng) return Promise.resolve({ income: 0, expense: 0 });
        const query = { start: rng.start, end: rng.end };
        return Promise.all([
          api.listCashflows(query),
          api.fetchWealthSummary(rng.start, rng.end, 'month'),
          api.listAccounts('asset'),
          api.listAccounts('liability')
        ]).then(([list, sumRes, assets, liabilities]) => {
          // 1. 计划收入 (Cashflow)
          const plannedIncome = (list || []).reduce(function(sum, x){ return sum + (x && x.type === 'income' && !!x.planned ? Number(x.amount || 0) : 0); }, 0);
          const actualIncome = (list || []).reduce(function(sum, x){ return sum + (x && x.type === 'income' && !x.planned ? Number(x.amount || 0) : 0); }, 0);
          
          // 2. 租金收入 (Rent Reminders)
          let rentIncome = 0;
          const rangeStart = new Date(rng.y, rng.m - 1, 1);
          const rangeEnd = new Date(rng.y, rng.m, 0);
          const inRange = (ds) => {
             const d = new Date(String(ds).replace(/-/g, "/"));
             return d >= rangeStart && d <= rangeEnd;
          };
          (rentReminders || []).forEach(r => {
             if (inRange(r.next_due_date)) {
                 rentIncome += Number(r.monthly_rent || 0);
             }
          });

          // 3. 资产月收益 (Asset Income)，排除已出租资产
          let assetMonthlyIncomeSum = 0;
          try {
            const monthIndex = rng.y * 12 + rng.m;
            (assets || []).forEach(acc => {
              if (!acc) return;
              // 排除已出租的资产（避免与租金收入重复）
              if (rentedAssetIds.has(Number(acc.id))) return;

              const mi = Number(acc.monthly_income || 0);
              if (!(mi > 0)) return;
              let started = true;
              let monthsElapsed = 0;
              if (acc.invest_start_date) {
                const s = new Date(String(acc.invest_start_date).trim().replace(/-/g, '/'));
                if (isNaN(s.getTime())) {
                  started = false;
                } else {
                  const si = s.getFullYear() * 12 + (s.getMonth() + 1);
                  monthsElapsed = monthIndex - si;
                  if (monthsElapsed < 0) started = false;
                }
              }
              if (!started) return;
              const term = Number(acc.investment_term_months || 0);
              if (term > 0 && monthsElapsed >= term) return;
              assetMonthlyIncomeSum += mi;
            });
          } catch (e2) { assetMonthlyIncomeSum = 0; }

          // 收入汇总：计划收入 + 租金 + 资产收益 (设计服务收入会在后续统一叠加)
          // 注意：这里不再使用复杂的循环收入推算逻辑，以保持与收支页面一致
          const income0 = plannedIncome + rentIncome + assetMonthlyIncomeSum;

          // 支出汇总：直接使用后端返回的 expected_expense，保持与收支页面一致
          const expense0 = Number(sumRes && sumRes.expected_expense != null ? sumRes.expected_expense : 0);

          return api.getMonthlySnapshot(rng.y, rng.m)
            .then((snap) => {
              // 如果有快照，支出使用快照值（通常等于 sumRes.expected_expense）
              // 收入强制使用前端计算值 income0，因为后端快照可能未包含租金等前端逻辑
              // 但如果快照有 external_income，应该加上吗？Wealth页面似乎没加，这里暂不加，保持一致
              const useIncome = income0;
              const useExpense = (snap && snap.expected_expense != null) ? Number(snap.expected_expense) : expense0;
              
              if (!snap) {
                // 如果没有快照，尝试保存一份（Wealth页面也会触发保存）
                return api.saveMonthlySnapshot(rng.y, rng.m)
                  .then((s) => {
                    // 保存后返回的值是后端算的，我们依然优先用前端算的 income0
                    const sexpense = (s && s.expected_expense != null) ? Number(s.expected_expense) : useExpense;
                    return { income: useIncome, expense: sexpense, y: rng.y, m: rng.m, plannedIncome, actualIncome, usedSnapshot: !!s };
                  })
                  .catch(() => ({ income: useIncome, expense: useExpense, y: rng.y, m: rng.m, plannedIncome, actualIncome, usedSnapshot: false }));
              }
              return { income: useIncome, expense: useExpense, y: rng.y, m: rng.m, plannedIncome, actualIncome, usedSnapshot: true };
            })
            .catch(() => ({ income: income0, expense: expense0, y: rng.y, m: rng.m, plannedIncome, actualIncome, usedSnapshot: false }));
        }).catch(() => ({ income: 0, expense: 0, y: rng.y, m: rng.m }));
      });
    let results = [];
    try {
      results = await Promise.all(tasks);
    } catch (e) {
      results = new Array(months.length).fill({ income: 0, expense: 0 });
    }
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    for (let i = 0; i < results.length; i++) {
      const r = results[i] || { income: 0, expense: 0 };
      try {
        const monthStr = `${r.y}-${String(r.m).padStart(2, '0')}`;
        const cacheKey = `fw_design_service_stats_month:${monthStr}`;
        let cached = null;
        try { cached = wx.getStorageSync(cacheKey); } catch (e2) { cached = null; }
        const fresh = cached && cached.data && cached.data.success && (Date.now() - (cached.ts || 0) < 5 * 60 * 1000);
        let total = 0;
        if (fresh) {
          total = Number(cached.data.data?.total_revenue || 0);
        } else {
          const stats = await api.getFinanceStats('month', monthStr);
          if (stats.success) total = Number(stats.data.total_revenue || 0);
          try { wx.setStorageSync(cacheKey, { data: stats, ts: Date.now() }); } catch (e3) {}
        }
        if (!r.usedSnapshot) {
          results[i].income += total;
        }
      } catch (e4) {}
    }
  },
  calculateCashflowDistribution(items = [], kind = 'income') {
    const buckets = {};
    const canon = (name, note) => {
      const n0 = String(name || '').trim();
      const nn = n0 || (kind === 'income' ? '其他收入' : '其他支出');
      if (kind === 'income') {
        const hay = `${nn} ${String(note || '')}`.toLowerCase();
        if (hay.includes('工资') || hay.includes('薪资') || hay.includes('薪水') || hay.includes('salary')) return '工资';
        if (hay.includes('租金')) return '租金收入';
        if (hay.includes('设计服务') || hay.includes('设计')) return '设计服务';
      }
      return nn;
    };
    (items || []).forEach(i => {
      const cat = canon(i.category, i.note);
      const amt = Number(i.amount || 0);
      if (amt <= 0) return;
      buckets[cat] = (buckets[cat] || 0) + amt;
    });
    const entries = Object.keys(buckets).map(name => ({ name, value: buckets[name] }));
    entries.sort((a, b) => b.value - a.value);
    if (!entries.length) return [];
    const MAX_SEGMENTS = 6;
    const pinnedIncome = new Set(['工资','工资收入','薪资','租金收入','设计服务']);
    const pinned = kind === 'income' ? pinnedIncome : new Set();
    const byName = new Map(entries.map(e => [e.name, e]));
    const pinnedList = Array.from(pinned).filter(n => byName.has(n)).map(n => byName.get(n));
    const remaining = entries.filter(e => !pinned.has(e.name));
    let processed = [];
    if (pinnedList.length >= MAX_SEGMENTS - 1) {
      const major = pinnedList.slice(0, MAX_SEGMENTS - 1);
      const others = [...remaining, ...pinnedList.slice(MAX_SEGMENTS - 1)];
      const othersValue = others.reduce((sum, item) => sum + item.value, 0);
      processed = [...major, { name: kind === 'income' ? '其他收入' : '其他支出', value: othersValue }];
    } else {
      const slots = MAX_SEGMENTS - 1 - pinnedList.length;
      const major = [...pinnedList, ...remaining.slice(0, Math.max(slots, 0))];
      if (major.length < entries.length) {
        const othersValue = entries.filter(e => !major.some(m => m.name === e.name)).reduce((sum, item) => sum + item.value, 0);
        processed = [...major, { name: kind === 'income' ? '其他收入' : '其他支出', value: othersValue }];
      } else {
        processed = major;
      }
    }
    const total = processed.reduce((sum, item) => sum + item.value, 0) || 1;
    const paletteIncome = ["#43B176", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#22c55e"];
    const paletteExpense = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4"];
    const palette = kind === 'income' ? paletteIncome : paletteExpense;
    return processed.map((item, idx) => ({ name: item.name, value: item.value, percentage: ((item.value / total) * 100).toFixed(1), color: palette[idx % palette.length] }));
  },
  drawIncomePie() {
    const data = this.data.incomeChartData || [];
    const query = wx.createSelectorQuery().in(this);
    query.select('#incomePie').fields({ node: true, size: true }).exec((res) => {
      const canvas = res && res[0] && res[0].node;
      const width = res && res[0] && res[0].width;
      const height = res && res[0] && res[0].height;
      if (!canvas) return;
      const dpr = (typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo().pixelRatio : 1) || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;
      const innerRadius = radius * 0.58;
      if (!data.length || data.every(x => Number(x.value) <= 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        ctx.fill();
        return;
      }
      let currentAngle = -Math.PI / 2;
      data.forEach(item => {
        const percentage = parseFloat(item.percentage) / 100;
        if (!percentage || percentage <= 0) return;
        const angle = percentage * 2 * Math.PI;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.arc(centerX, centerY, innerRadius, currentAngle + angle, currentAngle, true);
        ctx.closePath();
        ctx.fill();
        currentAngle += angle;
      });
      let angleStart = -Math.PI / 2;
      const labelsInc = [];
      data.forEach(item => {
        const pct = parseFloat(item.percentage) / 100;
        if (!pct || pct <= 0) return;
        const ang = pct * 2 * Math.PI;
        const mid = angleStart + ang / 2;
        const sx = centerX + Math.cos(mid) * radius;
        const sy = centerY + Math.sin(mid) * radius;
        const ex = centerX + Math.cos(mid) * (radius + 8);
        let ey = centerY + Math.sin(mid) * (radius + 8);
        const right = Math.cos(mid) >= 0;
        const hx = right ? ex + 28 : ex - 28;
        const text = `￥${this.formatNumber(item.value)}`;
        labelsInc.push({ sx, sy, ex, ey, hx, right, text });
        angleStart += ang;
      });
      const minGapInc = 14;
      const clampYInc = (y) => Math.max(12, Math.min(height - 12, y));
      const adjustGroupInc = (group) => {
        group.sort((a, b) => a.ey - b.ey);
        for (let i = 1; i < group.length; i++) {
          if (group[i].ey - group[i - 1].ey < minGapInc) {
            group[i].ey = group[i - 1].ey + minGapInc;
          }
        }
        for (let i = group.length - 2; i >= 0; i--) {
          group[i].ey = clampYInc(group[i].ey);
          if (group[i + 1].ey - group[i].ey < minGapInc) {
            group[i].ey = group[i + 1].ey - minGapInc;
          }
        }
        group.forEach(l => { l.ey = clampYInc(l.ey); });
      };
      const rightInc = labelsInc.filter(l => l.right);
      const leftInc = labelsInc.filter(l => !l.right);
      adjustGroupInc(rightInc);
      adjustGroupInc(leftInc);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      labelsInc.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.sx, l.sy);
        ctx.lineTo(l.ex, l.ey);
        ctx.lineTo(l.hx, l.ey);
        ctx.stroke();
        ctx.fillStyle = '#374151';
        ctx.font = '11px sans-serif';
        ctx.textAlign = l.right ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(l.text, l.hx + (l.right ? 4 : -4), l.ey);
      });
      const totalInc = (data || []).reduce((s, it) => s + (Number(it.value) > 0 ? Number(it.value) : 0), 0);
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '14px sans-serif';
      ctx.fillText(`￥${this.formatNumber(totalInc)}`, centerX, centerY);
    });
  },
  drawExpensePie() {
    const data = this.data.expenseChartData || [];
    const query = wx.createSelectorQuery().in(this);
    query.select('#expensePie').fields({ node: true, size: true }).exec((res) => {
      const canvas = res && res[0] && res[0].node;
      const width = res && res[0] && res[0].width;
      const height = res && res[0] && res[0].height;
      if (!canvas) return;
      const dpr = (typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo().pixelRatio : 1) || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;
      const innerRadius = radius * 0.58;
      if (!data.length || data.every(x => Number(x.value) <= 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        ctx.fill();
        return;
      }
      let currentAngle = -Math.PI / 2;
      data.forEach(item => {
        const percentage = parseFloat(item.percentage) / 100;
        if (!percentage || percentage <= 0) return;
        const angle = percentage * 2 * Math.PI;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.arc(centerX, centerY, innerRadius, currentAngle + angle, currentAngle, true);
        ctx.closePath();
        ctx.fill();
        currentAngle += angle;
      });
      let angleStart = -Math.PI / 2;
      const labelsExp = [];
      data.forEach(item => {
        const pct = parseFloat(item.percentage) / 100;
        if (!pct || pct <= 0) return;
        const ang = pct * 2 * Math.PI;
        const mid = angleStart + ang / 2;
        const sx = centerX + Math.cos(mid) * radius;
        const sy = centerY + Math.sin(mid) * radius;
        const ex = centerX + Math.cos(mid) * (radius + 8);
        let ey = centerY + Math.sin(mid) * (radius + 8);
        const right = Math.cos(mid) >= 0;
        const hx = right ? ex + 28 : ex - 28;
        const text = `￥${this.formatNumber(item.value)}`;
        labelsExp.push({ sx, sy, ex, ey, hx, right, text });
        angleStart += ang;
      });
      const minGapExp = 14;
      const clampYExp = (y) => Math.max(12, Math.min(height - 12, y));
      const adjustGroupExp = (group) => {
        group.sort((a, b) => a.ey - b.ey);
        for (let i = 1; i < group.length; i++) {
          if (group[i].ey - group[i - 1].ey < minGapExp) {
            group[i].ey = group[i - 1].ey + minGapExp;
          }
        }
        for (let i = group.length - 2; i >= 0; i--) {
          group[i].ey = clampYExp(group[i].ey);
          if (group[i + 1].ey - group[i].ey < minGapExp) {
            group[i].ey = group[i + 1].ey - minGapExp;
          }
        }
        group.forEach(l => { l.ey = clampYExp(l.ey); });
      };
      const rightExp = labelsExp.filter(l => l.right);
      const leftExp = labelsExp.filter(l => !l.right);
      adjustGroupExp(rightExp);
      adjustGroupExp(leftExp);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      labelsExp.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.sx, l.sy);
        ctx.lineTo(l.ex, l.ey);
        ctx.lineTo(l.hx, l.ey);
        ctx.stroke();
        ctx.fillStyle = '#374151';
        ctx.font = '11px sans-serif';
        ctx.textAlign = l.right ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(l.text, l.hx + (l.right ? 4 : -4), l.ey);
      });
      const totalExp = (data || []).reduce((s, it) => s + (Number(it.value) > 0 ? Number(it.value) : 0), 0);
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '14px sans-serif';
      ctx.fillText(`￥${this.formatNumber(totalExp)}`, centerX, centerY);
    });
  },
  prepareDailySeries(items, startDate, endDate) {
    const dim = endDate.getDate();
    const arr = new Array(dim).fill(0);
    (items || []).forEach(i => {
      const amt = Number(i.amount || 0);
      const ds = i.date;
      if (!ds) return;
      const d = new Date(String(ds).replace(/-/g, '/'));
      const day = d.getDate();
      if (amt > 0 && day >= 1 && day <= dim) arr[day - 1] += amt;
    });
    return arr;
  },
  drawIncomeTrend() {
    const series = this.data.incomeTrendSeries || [];
    const labels = this.data.incomeTrendLabels || [];
    const expenseSeries = this.data.expenseTrendSeries || [];
    const query = wx.createSelectorQuery().in(this);
    wx.nextTick(() => {
      query.select('#incomeTrendCanvas').node().select('#incomeTrendCanvas').boundingClientRect().exec((res) => {
        const canvas = res && res[0] && res[0].node;
        const rect = res && res[1];
        if (!canvas || !rect) return;
        const win = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 1;
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;
        let padL = 40; const padR = 16, padT = 16, padB = 24;
        let iw = 0, ih = 0;
        const drawEmpty = (text) => {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(17,24,39,0.4)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, w / 2, h / 2);
        };
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, w, h);
        const hasIncome = !!series && series.length > 0 && !series.every(v => Number(v) <= 0);
        const hasExpense = !!expenseSeries && expenseSeries.length > 0 && !expenseSeries.every(v => Number(v) <= 0);
        if (!hasIncome && !hasExpense) { drawEmpty('暂无收支趋势'); return; }
        const netSeries = new Array(Math.max(series.length, expenseSeries.length)).fill(0).map((_, i) => {
          const inc = Number(series[i] || 0);
          const exp = Number(expenseSeries[i] || 0);
          const net = inc - exp;
          return net > 0 ? net : 0;
        });
        const hasNet = netSeries.some(v => v > 0);
        const maxVal = Math.max(
          ...(hasIncome ? series : [0]),
          ...(hasExpense ? expenseSeries : [0]),
          ...(hasNet ? netSeries : [0])
        );
        const minVal = 0;
        const range = (maxVal - minVal) || 1;
        ctx.font = '12px sans-serif';
        const labelW = (ctx.measureText(this.formatAxisValue(maxVal)).width || 0);
        padL = Math.max(40, Math.ceil(labelW) + 12);
        iw = w - padL - padR;
        ih = h - padT - padB;
        ctx.strokeStyle = 'rgba(17,24,39,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, h - padB);
        ctx.lineTo(w - padR, h - padB);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, h - padB);
        ctx.stroke();
        const ticks = 4;
        ctx.strokeStyle = 'rgba(17,24,39,0.08)';
        for (let i = 0; i <= ticks; i++) {
          const y = padT + (i / ticks) * ih;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(w - padR, y);
          ctx.stroke();
          const val = maxVal - (i / ticks) * range;
          ctx.fillStyle = 'rgba(17,24,39,0.6)';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.formatAxisValue(val), padL - 6, y);
        }
        const toXY = (idx, arr) => {
          const x = padL + (idx / Math.max(arr.length - 1, 1)) * iw;
          const y = padT + (1 - ((arr[idx] - minVal) / range)) * ih;
          return { x, y };
        };
        if (hasIncome) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < series.length; i++) {
            const pt = toXY(i, series);
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
          for (let i = 0; i < series.length; i++) {
            const pt = toXY(i, series);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (hasExpense) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < expenseSeries.length; i++) {
            const pt = toXY(i, expenseSeries);
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.fillStyle = '#ef4444';
          for (let i = 0; i < expenseSeries.length; i++) {
            const pt = toXY(i, expenseSeries);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (hasNet) {
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < netSeries.length; i++) {
            const pt = toXY(i, netSeries);
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.fillStyle = '#6366f1';
          for (let i = 0; i < netSeries.length; i++) {
            const pt = toXY(i, netSeries);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = 'rgba(17,24,39,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < series.length; i++) {
          const x = padL + (i / Math.max(series.length - 1, 1)) * iw;
          const label = labels[i] || '';
          ctx.fillText(label, x, h - 6);
        }
        const xs = new Array(series.length).fill(0).map((_, i) => padL + (i / Math.max(series.length - 1, 1)) * iw);
        this._incomeTrendMeta = { padL, padR, padT, padB, iw, ih, w, h, rect, series, expenseSeries, labels, minVal, range, xs, netSeries };
        const sel = typeof this._incomeTrendSelectedIdx === 'number' ? this._incomeTrendSelectedIdx : -1;
        if (sel >= 0 && sel < series.length) {
          const x = xs[sel];
          const yIncome = padT + (1 - ((series[sel] - minVal) / (range || 1))) * ih;
          const yExpense = hasExpense ? padT + (1 - ((expenseSeries[sel] - minVal) / (range || 1))) * ih : null;
          const yNet = hasNet ? padT + (1 - (((netSeries[sel] || 0) - minVal) / (range || 1))) * ih : null;
          ctx.strokeStyle = 'rgba(17,24,39,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padT);
          ctx.lineTo(x, h - padB);
          ctx.stroke();
          if (hasIncome) {
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(x, yIncome, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          if (hasExpense && yExpense != null) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, yExpense, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          if (hasNet && yNet != null) {
            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            ctx.arc(x, yNet, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          const boxW = 180, boxH = hasExpense ? (hasNet ? 100 : 78) : (hasNet ? 78 : 54);
          const bx = Math.min(x + 8, w - padR - boxW);
          const by = padT + 8;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(bx, by, boxW, boxH);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(labels[sel] || '', bx + 8, by + 6);
          if (hasIncome) {
            ctx.fillStyle = '#22c55e';
            ctx.fillText(`收入 ${this.formatAxisValue(series[sel])}`, bx + 8, by + 26);
          }
          if (hasExpense) {
            ctx.fillStyle = '#ef4444';
            ctx.fillText(`支出 ${this.formatAxisValue(expenseSeries[sel])}`, bx + 8, by + (hasIncome ? 46 : 26));
          }
          if (hasNet) {
            ctx.fillStyle = '#6366f1';
            const yLine = hasIncome ? (hasExpense ? 66 : 46) : (hasExpense ? 46 : 26);
            ctx.fillText(`净收入 ${this.formatAxisValue(netSeries[sel] || 0)}`, bx + 8, by + yLine);
          }
        }
      });
    });
  },
  drawIncomeExpenseRatioTrend() {
    const income = this.data.incomeTrendSeries || [];
    const expense = this.data.expenseTrendSeries || [];
    const labels = this.data.incomeTrendLabels || [];
    const query = wx.createSelectorQuery().in(this);
    wx.nextTick(() => {
      query.select('#incomeExpenseRatioCanvas').node().select('#incomeExpenseRatioCanvas').boundingClientRect().exec((res) => {
        const canvas = res && res[0] && res[0].node;
        const rect = res && res[1];
        if (!canvas || !rect) return;
        const win = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 1;
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;
        let padL = 48; const padR = 16, padT = 16, padB = 24;
        let iw = 0, ih = 0;
        const ratios = new Array(Math.max(income.length, expense.length)).fill(0).map((_, i) => {
          const inVal = Number(income[i] || 0);
          const exVal = Number(expense[i] || 0);
          if (inVal <= 0 || exVal <= 0) return 0;
          return (inVal / exVal) * 100;
        });
        const hasData = ratios.some(r => r > 0);
        const drawEmpty = (text) => {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(17,24,39,0.4)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, w / 2, h / 2);
        };
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, w, h);
        if (!hasData) { drawEmpty('暂无收支比趋势'); return; }
        const maxR = Math.max(...ratios);
        const minR = Math.min(...ratios.filter(r => r > 0));
        const rangeR = (maxR - (minR || 0)) || 1;
        ctx.font = '12px sans-serif';
        const labelW = (ctx.measureText(`${Math.round(maxR)}%`).width || 0);
        padL = Math.max(48, Math.ceil(labelW) + 14);
        iw = w - padL - padR; ih = h - padT - padB;
        ctx.strokeStyle = 'rgba(17,24,39,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, h - padB);
        ctx.lineTo(w - padR, h - padB);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, h - padB);
        ctx.stroke();
        const ticks = 4;
        ctx.strokeStyle = 'rgba(17,24,39,0.08)';
        for (let i = 0; i <= ticks; i++) {
          const y = padT + (i / ticks) * ih;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(w - padR, y);
          ctx.stroke();
          const val = maxR - (i / ticks) * rangeR;
          ctx.fillStyle = 'rgba(17,24,39,0.6)';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${Math.round(val)}%`, padL - 6, y);
        }
        const toXY = (idx) => {
          const x = padL + (idx / Math.max(ratios.length - 1, 1)) * iw;
          const y = padT + (1 - ((ratios[idx] - (minR || 0)) / rangeR)) * ih;
          return { x, y };
        };
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < ratios.length; i++) {
          const pt = toXY(i);
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.fillStyle = '#8b5cf6';
        for (let i = 0; i < ratios.length; i++) {
          const pt = toXY(i);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(17,24,39,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < ratios.length; i++) {
          const x = padL + (i / Math.max(ratios.length - 1, 1)) * iw;
          const label = labels[i] || '';
          ctx.fillText(label, x, h - 6);
        }
        const xs = new Array(ratios.length).fill(0).map((_, i) => padL + (i / Math.max(ratios.length - 1, 1)) * iw);
        this._incomeExpenseRatioMeta = { padL, padR, padT, padB, iw, ih, w, h, rect, ratios, labels, xs, minR: (minR || 0), rangeR };
        const sel = typeof this._incomeExpenseRatioSelectedIdx === 'number' ? this._incomeExpenseRatioSelectedIdx : -1;
        if (sel >= 0 && sel < ratios.length) {
          const x = xs[sel];
          const y = padT + (1 - ((ratios[sel] - (minR || 0)) / (rangeR || 1))) * ih;
          ctx.strokeStyle = 'rgba(17,24,39,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padT);
          ctx.lineTo(x, h - padB);
          ctx.stroke();
          ctx.fillStyle = '#8b5cf6';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          const boxW = 160, boxH = 54;
          const bx = Math.min(x + 8, w - padR - boxW);
          const by = padT + 8;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(bx, by, boxW, boxH);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(labels[sel] || '', bx + 8, by + 6);
          ctx.fillStyle = '#8b5cf6';
          ctx.fillText(`收支比 ${Math.round(ratios[sel] || 0)}%`, bx + 8, by + 26);
        }
      });
    });
  },
  onIncomeExpenseRatioTouch(e) {
    const meta = this._incomeExpenseRatioMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = (typeof touch.x === 'number') ? touch.x : ((touch.clientX || 0) - (meta.rect.left || 0));
    const localY = (typeof touch.y === 'number') ? touch.y : ((touch.clientY || 0) - (meta.rect.top || 0));
    const inside = localX >= meta.padL && localX <= meta.padL + meta.iw && localY >= meta.padT && localY <= meta.padT + meta.ih;
    if (!inside) {
      this._incomeExpenseRatioSelectedIdx = -1;
      this.drawIncomeExpenseRatioTrend();
      return;
    }
    const len = meta.ratios.length;
    const xs = new Array(len).fill(0).map((_, i) => meta.padL + (i / Math.max(len - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < len; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }
    this._incomeExpenseRatioSelectedIdx = idx;
    this.drawIncomeExpenseRatioTrend();
  },
  drawExpenseTrend() {
    const series = this.data.expenseTrendSeries || [];
    const labels = this.data.expenseTrendLabels || [];
    const query = wx.createSelectorQuery().in(this);
    wx.nextTick(() => {
      query.select('#expenseTrendCanvas').node().select('#expenseTrendCanvas').boundingClientRect().exec((res) => {
        const canvas = res && res[0] && res[0].node;
        const rect = res && res[1];
        if (!canvas || !rect) return;
        const win = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 1;
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;
        let padL = 40; const padR = 16, padT = 16, padB = 24;
        let iw = 0, ih = 0;
        const drawEmpty = (text) => {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(17,24,39,0.4)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, w / 2, h / 2);
        };
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, w, h);
        if (!series || series.length === 0 || series.every(v => Number(v) <= 0)) { drawEmpty('暂无支出趋势'); return; }
        const maxVal = Math.max(...series);
        const minVal = 0;
        const range = (maxVal - minVal) || 1;
        ctx.font = '12px sans-serif';
        const labelW = (ctx.measureText(this.formatAxisValue(maxVal)).width || 0);
        padL = Math.max(40, Math.ceil(labelW) + 12);
        iw = w - padL - padR;
        ih = h - padT - padB;
        ctx.strokeStyle = 'rgba(17,24,39,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, h - padB);
        ctx.lineTo(w - padR, h - padB);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, h - padB);
        ctx.stroke();
        const ticks = 4;
        ctx.strokeStyle = 'rgba(17,24,39,0.08)';
        for (let i = 0; i <= ticks; i++) {
          const y = padT + (i / ticks) * ih;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(w - padR, y);
          ctx.stroke();
          const val = maxVal - (i / ticks) * range;
          ctx.fillStyle = 'rgba(17,24,39,0.6)';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.formatAxisValue(val), padL - 6, y);
        }
        const toXY = (idx) => {
          const x = padL + (idx / Math.max(series.length - 1, 1)) * iw;
          const y = padT + (1 - ((series[idx] - minVal) / range)) * ih;
          return { x, y };
        };
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < series.length; i++) {
          const pt = toXY(i);
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        for (let i = 0; i < series.length; i++) {
          const pt = toXY(i);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(17,24,39,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < series.length; i++) {
          const x = padL + (i / Math.max(series.length - 1, 1)) * iw;
          const label = labels[i] || '';
          ctx.fillText(label, x, h - 6);
        }
        const xs = new Array(series.length).fill(0).map((_, i) => padL + (i / Math.max(series.length - 1, 1)) * iw);
        this._expenseTrendMeta = { padL, padR, padT, padB, iw, ih, w, h, rect, series, labels, minVal, range, xs };
        const sel = typeof this._expenseTrendSelectedIdx === 'number' ? this._expenseTrendSelectedIdx : -1;
        if (sel >= 0 && sel < series.length) {
          const x = xs[sel];
          const y = padT + (1 - ((series[sel] - minVal) / (range || 1))) * ih;
          ctx.strokeStyle = 'rgba(17,24,39,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padT);
          ctx.lineTo(x, h - padB);
          ctx.stroke();
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          const boxW = 120, boxH = 54;
          const bx = Math.min(x + 8, w - padR - boxW);
          const by = padT + 8;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(bx, by, boxW, boxH);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(labels[sel] || '', bx + 8, by + 6);
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`支出 ${this.formatAxisValue(series[sel])}`, bx + 8, by + 26);
        }
      });
    });
  },
  onIncomeTrendTouch(e) {
    const meta = this._incomeTrendMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = (typeof touch.x === 'number') ? touch.x : ((touch.clientX || 0) - (meta.rect.left || 0));
    const localY = (typeof touch.y === 'number') ? touch.y : ((touch.clientY || 0) - (meta.rect.top || 0));
    const inside = localX >= meta.padL && localX <= meta.padL + meta.iw && localY >= meta.padT && localY <= meta.padT + meta.ih;
    
    // 清除已有的定时器
    if (this._incomeTrendTouchTimer) {
      clearTimeout(this._incomeTrendTouchTimer);
      this._incomeTrendTouchTimer = null;
    }

    if (!inside) {
      if (this._incomeTrendSelectedIdx !== -1) {
        this._incomeTrendSelectedIdx = -1;
        this.drawIncomeTrend();
        // 只有当停止滑动后才恢复默认数据
        this._incomeTrendTouchTimer = setTimeout(() => {
          this.fetchCashflowDistribution();
        }, 500);
      }
      return;
    }

    const xs = meta.xs || new Array(meta.series.length).fill(0).map((_, i) => meta.padL + (i / Math.max(meta.series.length - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }

    // 立即更新图表选中状态
    if (this._incomeTrendSelectedIdx !== idx) {
      this._incomeTrendSelectedIdx = idx;
      this.drawIncomeTrend();
    }

    // 延迟更新分布数据，仅当用户停留时触发
    this._incomeTrendTouchTimer = setTimeout(() => {
      this.updateDistributionByMonthIndex(idx);
    }, 500);
  },
  onExpenseTrendTouch(e) {
    const meta = this._expenseTrendMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = (typeof touch.x === 'number') ? touch.x : ((touch.clientX || 0) - (meta.rect.left || 0));
    const localY = (typeof touch.y === 'number') ? touch.y : ((touch.clientY || 0) - (meta.rect.top || 0));
    const inside = localX >= meta.padL && localX <= meta.padL + meta.iw && localY >= meta.padT && localY <= meta.padT + meta.ih;

    // 清除已有的定时器
    if (this._expenseTrendTouchTimer) {
      clearTimeout(this._expenseTrendTouchTimer);
      this._expenseTrendTouchTimer = null;
    }

    if (!inside) {
      if (this._expenseTrendSelectedIdx !== -1) {
        this._expenseTrendSelectedIdx = -1;
        this.drawExpenseTrend();
        // 只有当停止滑动后才恢复默认数据
        this._expenseTrendTouchTimer = setTimeout(() => {
          this.fetchCashflowDistribution();
        }, 500);
      }
      return;
    }

    const xs = meta.xs || new Array(meta.series.length).fill(0).map((_, i) => meta.padL + (i / Math.max(meta.series.length - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }

    // 立即更新图表选中状态
    if (this._expenseTrendSelectedIdx !== idx) {
      this._expenseTrendSelectedIdx = idx;
      this.drawExpenseTrend();
    }

    // 延迟更新分布数据，仅当用户停留时触发
    this._expenseTrendTouchTimer = setTimeout(() => {
      this.updateDistributionByMonthIndex(idx);
    }, 500);
  },
  async updateDistributionByMonthIndex(idx) {
    try {
      const points = this.data.monthly || [];
      const p = points[idx];
      if (!p || !p.month) return;
      const parts = String(p.month).split('-');
      const y = parseInt(parts[0] || '0');
      const m = parseInt(parts[1] || '0');
      if (!y || !m) return;
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0);
      const start = this.formatDate(startDate);
      const end = this.formatDate(endDate);
      const query = { start, end };
      let list = [];
      try { list = await api.listCashflows(query); } catch (e0) { list = []; }

      const rangeStart = start ? new Date(String(start).trim().replace(/-/g, "/")) : null;
      const rangeEnd = end ? new Date(String(end).trim().replace(/-/g, "/")) : null;
      const inRange = (ds) => {
        if (!rangeStart || !rangeEnd) return true;
        const d = new Date(String(ds).trim().replace(/-/g, "/"));
        if (isNaN(d.getTime())) return false;
        return d >= rangeStart && d <= rangeEnd;
      };

      let rents = [];
      let assets = [];
      try {
        const res = await Promise.all([
          api.listRentReminders(90),
          api.listAccounts("asset")
        ]);
        const reminders = res[0] || [];
        assets = res[1] || [];
        rents = (reminders || []).filter(r => inRange(r.next_due_date)).map((r) => ({
          id: `tenancy:${r.tenancy_id}`,
          type: 'income',
          category: '租金收入',
          amount: Number(r.monthly_rent || 0),
          date: r.next_due_date,
          planned: true
        }));
      } catch (errA) { rents = []; assets = []; }

      let assetIncomes = [];
      try {
        (assets || []).forEach((acc) => {
          const mi = Number(acc.monthly_income || 0);
          if (mi > 0) {
            assetIncomes.push({
              id: `asset-income:${acc.id}`,
              type: 'income',
              category: acc.category || '资产收益',
              amount: mi,
              date: end,
              planned: true
            });
          }
        });
      } catch (errB) { assetIncomes = []; }

      let debts = [];
      try {
        let liabilities = [];
        try { liabilities = await api.listAccounts("liability"); } catch (eL) { liabilities = []; }
        const clampDay = (yy, mm, dd) => { const dim = new Date(yy, mm, 0).getDate(); return Math.max(1, Math.min(dim, Number(dd) || 1)); };
        const pushPayment = (acc, yy, mm, dd) => {
          const dt = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
          debts.push({ id: `loan:${acc.id}:${yy}${String(mm).padStart(2, '0')}`, type: 'expense', category: (acc.category || '负债') + '月供', amount: Number(acc.monthly_payment || 0), date: dt, planned: true });
        };
        (liabilities || []).forEach((acc) => {
          const mp = Number(acc.monthly_payment || 0);
          const startStr = acc.loan_start_date;
          const term = Number(acc.loan_term_months || 0);
          const endStr = acc.loan_end_date;
          if (!mp) return;
          if (!rangeStart || !rangeEnd) return;
          if (!startStr) {
            const dd = clampDay(y, m, 1);
            if (endStr) {
              const e = new Date(String(endStr).trim().replace(/-/g, '/'));
              if (!isNaN(e.getTime())) {
                const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
                const mi = y * 12 + m;
                if (mi > ei) return;
              }
            }
            pushPayment(acc, y, m, dd);
            return;
          }
          const s = new Date(String(startStr).trim().replace(/-/g, "/"));
          if (isNaN(s.getTime())) return;
          const dueDay = s.getDate();
          let yy = y; let mm = m;
          while (true) {
            const dd = clampDay(yy, mm, dueDay);
            const cand = new Date(yy, mm - 1, dd);
            if (cand < s) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } continue; }
            if (cand > rangeEnd) break;
            const monthIndex = yy * 12 + mm;
            const startIndex = s.getFullYear() * 12 + (s.getMonth() + 1);
            const monthsElapsed = monthIndex - startIndex;
            if (monthsElapsed < 0) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } continue; }
            if (term > 0 && monthsElapsed >= term) break;
            if (endStr) {
              const e = new Date(String(endStr).trim().replace(/-/g, '/'));
              if (!isNaN(e.getTime())) {
                const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
                if (monthIndex > ei) break;
              }
            }
            if (cand >= rangeStart && cand <= rangeEnd) pushPayment(acc, yy, mm, dd);
            mm += 1; if (mm > 12) { mm = 1; yy += 1; }
          }
        });
      } catch (errC) { debts = []; }

      let designServiceIncome = [];
      try {
        const isCurrentMonth = (y === new Date().getFullYear() && m === (new Date().getMonth() + 1));
        const monthStr = `${y}-${String(m).padStart(2, '0')}`;
        const cacheKey = `fw_design_service_stats_month:${monthStr}`;
        let cached = null;
        try { cached = wx.getStorageSync(cacheKey); } catch (eX) { cached = null; }
        const fresh = cached && cached.data && cached.data.success && (Date.now() - (cached.ts || 0) < 5 * 60 * 1000);
        let total = 0;
        if (fresh) {
          total = Number(cached.data.data?.total_revenue || 0);
        } else {
          const stats = isCurrentMonth ? await api.getFinanceStats('month') : await api.getFinanceStats('month', monthStr);
          if (stats && stats.success) {
            total = Number(stats.data.total_revenue || 0);
            try { wx.setStorageSync(cacheKey, { data: stats, ts: Date.now() }); } catch (eY) {}
          }
        }
        if (total > 0) {
          designServiceIncome = [{ id: `design-service:${monthStr}`, type: 'income', category: '设计服务', amount: total, date: end, planned: true }];
        }
      } catch (errD) { designServiceIncome = []; }

      let recurringSynth = [];
      try {
        const prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        const prevStart = this.formatDate(prevStartDate);
        const prevEnd = this.formatDate(prevEndDate);
        const prevQuery = { start: prevStart, end: prevEnd, type: 'income', planned: true };
        let prevList = [];
        try { prevList = await api.listCashflows(prevQuery); } catch (ePrev) { prevList = []; }
        const currKeys = new Set((list || [])
          .filter(i => i.type === 'income' && !!i.planned && !!i.recurring_monthly)
          .map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
        (prevList || [])
          .filter(i => i && i.type === 'income' && !!i.planned && !!i.recurring_monthly)
          .forEach(t => {
            const key = `${t.type}:${t.category}:${t.note ? t.note : t.category}`;
            if (!currKeys.has(key)) {
              const prevDay = (() => { const d = new Date(String(t.date).replace(/-/g, '/')); return d.getDate(); })();
              const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, prevDay)); })();
              const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
              recurringSynth.push({ id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`, type: 'income', category: t.category || '其他收入', amount: Number(t.amount || 0), date: dt, planned: true });
            }
          });
      } catch (eRS) { recurringSynth = []; }

      let recurringSynthExpense = [];
      try {
        const prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        const prevStart = this.formatDate(prevStartDate);
        const prevEnd = this.formatDate(prevEndDate);
        const prevQuery = { start: prevStart, end: prevEnd, type: 'expense', planned: true };
        let prevList = [];
        try { prevList = await api.listCashflows(prevQuery); } catch (ePrev2) { prevList = []; }
        const currKeys = new Set((list || [])
          .filter(i => i.type === 'expense' && !!i.planned && !!i.recurring_monthly)
          .map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
        (prevList || [])
          .filter(i => i && i.type === 'expense' && !!i.planned && !!i.recurring_monthly)
          .forEach(t => {
            const key = `${t.type}:${t.category}:${t.note ? t.note : t.category}`;
            if (!currKeys.has(key)) {
              const prevDay = (() => { const d = new Date(String(t.date).replace(/-/g, '/')); return d.getDate(); })();
              const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, prevDay)); })();
              const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
              recurringSynthExpense.push({ id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`, type: 'expense', category: t.category || '其他支出', amount: Number(t.amount || 0), date: dt, planned: true });
            }
          });
      } catch (eRSE) { recurringSynthExpense = []; }

      let localMasters = [];
      try {
        const monthKey = `${y}${String(m).padStart(2, '0')}`;
        let masters = wx.getStorageSync('fw_recurring_masters');
        let skipStore = wx.getStorageSync('fw_recurring_skip');
        const skippedArr = skipStore && typeof skipStore === 'object' ? (skipStore[monthKey] || []) : [];
        
        if (masters && typeof masters === 'object') {
             const recordedKeys = new Set((list || [])
              .filter(i => !!i.planned && !!i.recurring_monthly)
              .map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
             
             const synthKeys = new Set([...recurringSynth, ...recurringSynthExpense]
                .map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));

             Object.values(masters).forEach(ms => {
                if (!ms) return;
                const s = ms.start_date ? new Date(String(ms.start_date).replace(/-/g, '/')) : null;
                if (!s) return;
                const startKey = `${s.getFullYear()}${String(s.getMonth() + 1).padStart(2, '0')}`;
                if (startKey > monthKey) return;
                
                if (ms.end_date) {
                  const e = new Date(String(ms.end_date).replace(/-/g, '/'));
                  const endKey = `${e.getFullYear()}${String(e.getMonth() + 1).padStart(2, '0')}`;
                  if (monthKey > endKey) return;
                }

                const key = `${ms.type}:${ms.category}:${ms.note || ms.category}`;
                if (recordedKeys.has(key) || synthKeys.has(key)) return;
                
                const syntheticId = `recurring:local:${key}:${monthKey}`;
                if (skippedArr.indexOf(syntheticId) >= 0) return;

                const amt = Number(ms.amount || 0);
                if (amt > 0) {
                    localMasters.push({
                        id: syntheticId,
                        type: ms.type,
                        category: ms.category,
                        note: ms.note,
                        amount: amt,
                        date: end, 
                        planned: true,
                        recurring_monthly: true
                    });
                }
             });
        }
      } catch (eLocal) {
          localMasters = [];
      }

      let yearSynthIncome = [];
      let yearSynthExpense = [];
      try {
        const yearStart = `${y}-01-01`;
        const yearEnd = `${y}-12-31`;
        const allPlanned = await api.listCashflows({ start: yearStart, end: yearEnd, planned: true });
        const defs = (allPlanned || []).filter(i => !!i.recurring_monthly);
        const recIncomeDefs = defs.filter(i => i.type === 'income').map(i => ({
          key: `${i.type}:${i.category}:${i.note ? i.note : i.category}`,
          amount: Number(i.amount || 0),
          start: String(i.recurring_start_date || i.date || ''),
          end: String(i.recurring_end_date || ''),
          category: i.category || ''
        }));
        const recExpenseDefs = defs.filter(i => i.type === 'expense').map(i => ({
          key: `${i.type}:${i.category}:${i.note ? i.note : i.category}`,
          amount: Number(i.amount || 0),
          start: String(i.recurring_start_date || i.date || ''),
          end: String(i.recurring_end_date || ''),
          category: i.category || ''
        }));
        const recordedKeys = new Set((list || []).filter(i => !!i.recurring_monthly && !!i.planned).map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
        const synthKeys = new Set([...recurringSynth, ...recurringSynthExpense].map(i => `${i.type}:${i.category}:${i.note ? i.note : i.category}`));
        const md = new Date(y, m - 1, 1);
        recIncomeDefs.forEach(d => {
          const s = d.start ? new Date(String(d.start).replace(/-/g, '/')) : null;
          const e = d.end ? new Date(String(d.end).replace(/-/g, '/')) : null;
          if (s && isNaN(s.getTime())) return;
          if (e && isNaN(e.getTime())) return;
          if (s && md < new Date(s.getFullYear(), s.getMonth(), 1)) return;
          if (e && md > new Date(e.getFullYear(), e.getMonth(), 1)) return;
          const key = d.key;
          if (recordedKeys.has(key) || synthKeys.has(key)) return;
          yearSynthIncome.push({ id: `recurring:year:${key}:${y}${String(m).padStart(2, '0')}`, type: 'income', category: d.category || '其他收入', amount: Number(d.amount || 0), date: end, planned: true });
        });
        recExpenseDefs.forEach(d => {
          const s = d.start ? new Date(String(d.start).replace(/-/g, '/')) : null;
          const e = d.end ? new Date(String(d.end).replace(/-/g, '/')) : null;
          if (s && isNaN(s.getTime())) return;
          if (e && isNaN(e.getTime())) return;
          if (s && md < new Date(s.getFullYear(), s.getMonth(), 1)) return;
          if (e && md > new Date(e.getFullYear(), e.getMonth(), 1)) return;
          const key = d.key;
          if (recordedKeys.has(key) || synthKeys.has(key)) return;
          yearSynthExpense.push({ id: `recurring:year:${key}:${y}${String(m).padStart(2, '0')}`, type: 'expense', category: d.category || '其他支出', amount: Number(d.amount || 0), date: end, planned: true });
        });
      } catch (eYear) { yearSynthIncome = []; yearSynthExpense = []; }

      const recorded = (list || []).map(x => ({ type: x.type, category: x.category, note: x.note, amount: Number(x.amount || 0), planned: !!x.planned }));
      const combinedAll = [...recorded, ...rents, ...assetIncomes, ...debts, ...designServiceIncome, ...recurringSynth, ...recurringSynthExpense, ...localMasters, ...yearSynthIncome, ...yearSynthExpense];
      const incomeItems = combinedAll.filter(i => i.type === 'income');
      const expenseItems = combinedAll.filter(i => i.type === 'expense' && i.planned);
      const incomeChartData = this.calculateCashflowDistribution(incomeItems, 'income');
      const expenseChartData = this.calculateCashflowDistribution(expenseItems, 'expense');
      this.setData({ incomeChartData, expenseChartData }, () => { this.drawIncomePie(); this.drawExpensePie(); });
    } catch (errZ) {
      this.setData({ incomeChartData: [], expenseChartData: [] });
    }
  },
  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  drawMonthlyCharts() {
    const points = this.data.monthly || [];
    const win = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = win.pixelRatio || 1;
    const query = wx.createSelectorQuery().in(this);
    wx.nextTick(() => {
      query
        .select('#monthlyValueCanvas').node()
        .select('#monthlyValueCanvas').boundingClientRect()
        .select('#monthlyRatioCanvas').node()
        .select('#monthlyRatioCanvas').boundingClientRect()
        .exec((res) => {
          const valueCanvas = res && res[0] && res[0].node;
          const valueRect = res && res[1];
          const ratioCanvas = res && res[2] && res[2].node;
          const ratioRect = res && res[3];
          if (!valueCanvas || !valueRect || !ratioCanvas || !ratioRect) return;
          valueCanvas.width = Math.floor(valueRect.width * dpr);
          valueCanvas.height = Math.floor(valueRect.height * dpr);
          const ctx1 = valueCanvas.getContext('2d');
          ctx1.scale(dpr, dpr);
          ratioCanvas.width = Math.floor(ratioRect.width * dpr);
          ratioCanvas.height = Math.floor(ratioRect.height * dpr);
          const ctx2 = ratioCanvas.getContext('2d');
          ctx2.scale(dpr, dpr);

          const w1 = valueRect.width, h1 = valueRect.height;
          const w2 = ratioRect.width, h2 = ratioRect.height;
          let padL = 48; const padR = 20, padT = 16, padB = 26;
          let iw1 = 0, ih1 = 0;
          let iw2 = 0, ih2 = 0;

          const drawEmpty = (ctx, w, h, text) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(17,24,39,0.4)';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, w / 2, h / 2);
          };

          ctx1.clearRect(0, 0, w1, h1);
          ctx2.clearRect(0, 0, w2, h2);
          ctx1.fillStyle = 'rgba(255,255,255,0.04)';
          ctx1.fillRect(0, 0, w1, h1);
          ctx2.fillStyle = 'rgba(255,255,255,0.04)';
          ctx2.fillRect(0, 0, w2, h2);

          if (!points || points.length === 0) {
            drawEmpty(ctx1, w1, h1, '暂无月度数据');
            drawEmpty(ctx2, w2, h2, '暂无月度数据');
            return;
          }

          // 过滤掉没有数据的月份（资产、负债、净资产都为0）
          const filteredPoints = points.filter(p => {
            const a = Number(p.total_assets || 0);
            const l = Number(p.total_liabilities || 0);
            const n = Number(p.net_worth || 0);
            return Math.abs(a) > 0.01 || Math.abs(l) > 0.01 || Math.abs(n) > 0.01;
          });

          if (filteredPoints.length === 0) {
            drawEmpty(ctx1, w1, h1, '暂无月度数据');
            drawEmpty(ctx2, w2, h2, '暂无月度数据');
            return;
          }

          const assets = filteredPoints.map(p => Number(p.total_assets || 0));
          const liabilities = filteredPoints.map(p => Number(p.total_liabilities || 0));
          const net = filteredPoints.map(p => Number(p.net_worth || 0));
          const allVals = assets.concat(liabilities).concat(net);
          const maxVal = Math.max(...allVals);
          const minVal = Math.min(...allVals);
          const range = maxVal - minVal || 1;
          ctx1.font = '12px sans-serif';
          const labelW1 = (ctx1.measureText(this.formatAxisValue(maxVal)).width || 0);
          padL = Math.max(48, Math.ceil(labelW1) + 14);
          iw1 = w1 - padL - padR; ih1 = h1 - padT - padB;
          iw2 = w2 - padL - padR; ih2 = h2 - padT - padB;
          const toXY = (arr, idx) => {
            const x = padL + (idx / Math.max(filteredPoints.length - 1, 1)) * iw1;
            const y = padT + (1 - ((arr[idx] - minVal) / range)) * ih1;
            return { x, y };
          };
          const series = [
            { data: assets, color: '#10b981' },
            { data: liabilities, color: '#ef4444' },
            { data: net, color: '#6366f1' }
          ];
          ctx1.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx1.lineWidth = 1;
          ctx1.beginPath();
          ctx1.moveTo(padL, h1 - padB);
          ctx1.lineTo(w1 - padR, h1 - padB);
          ctx1.stroke();
          ctx1.beginPath();
          ctx1.moveTo(padL, padT);
          ctx1.lineTo(padL, h1 - padB);
          ctx1.stroke();
          const tickCount1 = 4;
          ctx1.strokeStyle = 'rgba(17,24,39,0.08)';
          for (let i = 0; i <= tickCount1; i++) {
            const y = padT + (i / tickCount1) * ih1;
            ctx1.beginPath();
            ctx1.moveTo(padL, y);
            ctx1.lineTo(w1 - padR, y);
            ctx1.stroke();
            const val = maxVal - (i / tickCount1) * range;
            ctx1.fillStyle = 'rgba(17,24,39,0.6)';
            ctx1.font = '12px sans-serif';
            ctx1.textAlign = 'right';
            ctx1.textBaseline = 'middle';
            ctx1.fillText(this.formatAxisValue(val), padL - 6, y);
          }
          series.forEach(s => {
            ctx1.strokeStyle = s.color;
            ctx1.lineWidth = 3;
            ctx1.beginPath();
            for (let i = 0; i < filteredPoints.length; i++) {
              const pt = toXY(s.data, i);
              if (i === 0) ctx1.moveTo(pt.x, pt.y); else ctx1.lineTo(pt.x, pt.y);
            }
            ctx1.stroke();
          });
          // 点标记（净资产）
          ctx1.fillStyle = '#10b981';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY(assets, i);
            ctx1.beginPath();
            ctx1.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx1.fill();
          }
          ctx1.fillStyle = '#ef4444';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY(liabilities, i);
            ctx1.beginPath();
            ctx1.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx1.fill();
          }
          ctx1.fillStyle = '#6366f1';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY(net, i);
            ctx1.beginPath();
            ctx1.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx1.fill();
          }
          ctx1.fillStyle = 'rgba(17,24,39,0.5)';
          ctx1.font = '12px sans-serif';
          ctx1.textAlign = 'center';
          for (let i = 0; i < filteredPoints.length; i++) {
            const x = padL + (i / Math.max(filteredPoints.length - 1, 1)) * iw1;
            ctx1.fillText(this.getMonthLabel(filteredPoints[i].month), x, h1 - 6);
          }
          // 选中高亮（资产图）
          const selV = typeof this._monthlyValueSelectedIdx === 'number' ? this._monthlyValueSelectedIdx : -1;
          if (selV >= 0 && selV < filteredPoints.length) {
            const x = padL + (selV / Math.max(filteredPoints.length - 1, 1)) * iw1;
            const toY1 = (v) => padT + (1 - ((v - minVal) / (range || 1))) * ih1;
            const ya = toY1(assets[selV]);
            const yl = toY1(liabilities[selV]);
            const yn = toY1(net[selV]);
            ctx1.strokeStyle = 'rgba(17,24,39,0.25)';
            ctx1.lineWidth = 1;
            ctx1.beginPath();
            ctx1.moveTo(x, padT);
            ctx1.lineTo(x, h1 - padB);
            ctx1.stroke();
            const drawDot1 = (y, color) => { ctx1.fillStyle = color; ctx1.beginPath(); ctx1.arc(x, y, 4, 0, Math.PI * 2); ctx1.fill(); };
            drawDot1(ya, '#10b981');
            drawDot1(yl, '#ef4444');
            drawDot1(yn, '#6366f1');
            const boxW = 140, boxH = 78;
            const bx = Math.min(x + 8, w1 - padR - boxW);
            const by = padT + 8;
            ctx1.fillStyle = 'rgba(255,255,255,0.9)';
            ctx1.strokeStyle = 'rgba(17,24,39,0.15)';
            ctx1.lineWidth = 1;
            ctx1.beginPath();
            ctx1.rect(bx, by, boxW, boxH);
            ctx1.fill();
            ctx1.stroke();
            ctx1.fillStyle = '#374151';
            ctx1.textAlign = 'left';
            ctx1.textBaseline = 'top';
            ctx1.fillText(this.getMonthLabel(filteredPoints[selV].month), bx + 8, by + 6);
            ctx1.fillStyle = '#10b981';
            ctx1.fillText(`资产 ${this.formatAxisValue(assets[selV])}`, bx + 8, by + 24);
            ctx1.fillStyle = '#ef4444';
            ctx1.fillText(`负债 ${this.formatAxisValue(liabilities[selV])}`, bx + 8, by + 40);
            ctx1.fillStyle = '#6366f1';
            ctx1.fillText(`净值 ${this.formatAxisValue(net[selV])}`, bx + 8, by + 56);
          }

          const ratios = filteredPoints.map(p => Number(p.debt_ratio || 0));
          const maxR = Math.max(100, Math.max(...ratios));
          const minR = Math.min(0, Math.min(...ratios));
          const rangeR = maxR - minR || 1;
          const toXY2 = (idx) => {
            const x = padL + (idx / Math.max(filteredPoints.length - 1, 1)) * iw2;
            const y = padT + (1 - ((ratios[idx] - minR) / rangeR)) * ih2;
            return { x, y };
          };
          ctx2.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx2.lineWidth = 1;
          ctx2.beginPath();
          ctx2.moveTo(padL, h2 - padB);
          ctx2.lineTo(w2 - padR, h2 - padB);
          ctx2.stroke();
          ctx2.beginPath();
          ctx2.moveTo(padL, padT);
          ctx2.lineTo(padL, h2 - padB);
          ctx2.stroke();
          const tickCount2 = 4;
          ctx2.strokeStyle = 'rgba(17,24,39,0.08)';
          for (let i = 0; i <= tickCount2; i++) {
            const y = padT + (i / tickCount2) * ih2;
            ctx2.beginPath();
            ctx2.moveTo(padL, y);
            ctx2.lineTo(w2 - padR, y);
            ctx2.stroke();
            const val = maxR - (i / tickCount2) * rangeR;
            ctx2.fillStyle = 'rgba(17,24,39,0.6)';
            ctx2.font = '12px sans-serif';
            ctx2.textAlign = 'right';
            ctx2.textBaseline = 'middle';
            ctx2.fillText(`${Math.round(val)}%`, padL - 6, y);
          }
          ctx2.strokeStyle = '#8b5cf6';
          ctx2.lineWidth = 3;
          ctx2.beginPath();
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY2(i);
            if (i === 0) ctx2.moveTo(pt.x, pt.y); else ctx2.lineTo(pt.x, pt.y);
          }
          ctx2.stroke();
          // 点标记（负债率）
          ctx2.fillStyle = '#8b5cf6';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY2(i);
            ctx2.beginPath();
            ctx2.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx2.fill();
          }
          ctx2.fillStyle = 'rgba(17,24,39,0.5)';
          ctx2.font = '12px sans-serif';
          ctx2.textAlign = 'center';
          for (let i = 0; i < filteredPoints.length; i++) {
            const x = padL + (i / Math.max(filteredPoints.length - 1, 1)) * iw2;
            ctx2.fillText(this.getMonthLabel(filteredPoints[i].month), x, h2 - 6);
          }
          // 选中高亮（负债率图）
          const selR = typeof this._monthlyRatioSelectedIdx === 'number' ? this._monthlyRatioSelectedIdx : -1;
          if (selR >= 0 && selR < filteredPoints.length) {
            const x = padL + (selR / Math.max(filteredPoints.length - 1, 1)) * iw2;
            const y = padT + (1 - ((ratios[selR] - minR) / (rangeR || 1))) * ih2;
            ctx2.strokeStyle = 'rgba(17,24,39,0.25)';
            ctx2.lineWidth = 1;
            ctx2.beginPath();
            ctx2.moveTo(x, padT);
            ctx2.lineTo(x, h2 - padB);
            ctx2.stroke();
            ctx2.fillStyle = '#8b5cf6';
            ctx2.beginPath();
            ctx2.arc(x, y, 4, 0, Math.PI * 2);
            ctx2.fill();
            const boxW = 120, boxH = 54;
            const bx = Math.min(x + 8, w2 - padR - boxW);
            const by = padT + 8;
            ctx2.fillStyle = 'rgba(255,255,255,0.9)';
            ctx2.strokeStyle = 'rgba(17,24,39,0.15)';
            ctx2.lineWidth = 1;
            ctx2.beginPath();
            ctx2.rect(bx, by, boxW, boxH);
            ctx2.fill();
            ctx2.stroke();
            ctx2.fillStyle = '#374151';
            ctx2.textAlign = 'left';
            ctx2.textBaseline = 'top';
            ctx2.fillText(this.getMonthLabel(filteredPoints[selR].month), bx + 8, by + 6);
            ctx2.fillStyle = '#8b5cf6';
            ctx2.fillText(`负债率 ${Number(ratios[selR]).toFixed(1)}%`, bx + 8, by + 24);
          }

          // 交互元数据保存
          this._monthlyValueMeta = {
            padL, padR, padT, padB, iw: iw1, ih: ih1, w: w1, h: h1,
            minVal, range, assets, liabilities, net, points: filteredPoints,
            rect: valueRect, ctx: ctx1
          };
          this._monthlyRatioMeta = {
            padL, padR, padT, padB, iw: iw2, ih: ih2, w: w2, h: h2,
            minR, rangeR, ratios, points: filteredPoints,
            rect: ratioRect, ctx: ctx2
          };
        });
    });
  },
  onMonthlyValueTouch(e) {
    const meta = this._monthlyValueMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = (typeof touch.x === 'number') ? touch.x : ((touch.clientX || 0) - (meta.rect.left || 0));
    const localY = (typeof touch.y === 'number') ? touch.y : ((touch.clientY || 0) - (meta.rect.top || 0));
    const inside = localX >= meta.padL && localX <= meta.padL + meta.iw && localY >= meta.padT && localY <= meta.padT + meta.ih;
    if (!inside) {
      this._monthlyValueSelectedIdx = -1;
      this.drawMonthlyCharts();
      return;
    }
    const len = meta.points.length;
    const xs = new Array(len).fill(0).map((_, i) => meta.padL + (i / Math.max(len - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < len; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }
    this._monthlyValueSelectedIdx = idx;
    this.drawMonthlyCharts();
  },
  onMonthlyRatioTouch(e) {
    const meta = this._monthlyRatioMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = (typeof touch.x === 'number') ? touch.x : ((touch.clientX || 0) - (meta.rect.left || 0));
    const localY = (typeof touch.y === 'number') ? touch.y : ((touch.clientY || 0) - (meta.rect.top || 0));
    const inside = localX >= meta.padL && localX <= meta.padL + meta.iw && localY >= meta.padT && localY <= meta.padT + meta.ih;
    if (!inside) {
      this._monthlyRatioSelectedIdx = -1;
      this.drawMonthlyCharts();
      return;
    }
    const len = meta.points.length;
    const xs = new Array(len).fill(0).map((_, i) => meta.padL + (i / Math.max(len - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < len; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }
    this._monthlyRatioSelectedIdx = idx;
    this.drawMonthlyCharts();
  },
  clearMonthlySelection() {
    this._monthlyValueSelectedIdx = -1;
    this._monthlyRatioSelectedIdx = -1;
    this.drawMonthlyCharts();
  },
  noop() {},
  getMonthLabel(dateStr) {
    if (!dateStr) return "";
    const parts = String(dateStr).split("-");
    if (parts.length < 2) return dateStr;
    return `${parseInt(parts[1])}月`;
  },
  formatAxisValue(value) {
    const num = Number(value || 0);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    return `${sign}${Math.round(abs)}元`;
  },
  async handleLogin() {
    const app = getApp();
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true, error: "" });
    try {
      if (typeof app.ensureLogin === "function") {
        await app.ensureLogin();
      } else {
        await app.login();
      }
      this.setData({ needLogin: false, loggingIn: false });
      this.fetchAnalytics();
    } catch (e) {
      this.setData({ loggingIn: false, error: "登录失败，请重试" });
    }
  },
  formatSummary(summary) {
    const netWorth = this.formatNumber(summary.net_worth);
    const totalAssets = this.formatNumber(summary.total_assets);
    const totalLiabilities = this.formatNumber(summary.total_liabilities);
    const netChangeValue = Number(summary.net_change || 0);
    const changeRatioValue = Number(summary.change_ratio || 0);
    const debtRatioValue = Number(summary.debt_ratio || 0);
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      netChange: this.formatSignedNumber(netChangeValue),
      changeRatio: `${changeRatioValue >= 0 ? "+" : ""}${changeRatioValue.toFixed(2)}%`,
      changeRatioValue,
      debtRatio: `${debtRatioValue.toFixed(2)}%`,
      debtRatioValue
    };
  },
  prepareCategories(list, type) {
    return (list || []).map((item) => {
      const cat = type === "asset" ? normalizeAssetCategory(item.category) : item.category;
      return {
        ...item,
        category: cat,
        amountText: `￥${this.formatNumber(item.amount)}`,
        percentageText: `${Number(item.percentage || 0).toFixed(2)}%`,
        barClass: type === "asset" ? "asset-bar" : "liability-bar",
        icon: type === "asset" ? getAssetCategoryIcon(cat) : getLiabilityCategoryIcon(cat)
      };
    });
  },
  formatHighlights(highlights) {
    const best = normalizeAssetCategory(highlights.best_category || "");
    const risk = normalizeAssetCategory(highlights.risk_category || "");
    return {
      bestCategory: best || "-",
      bestCategoryAmount: `￥${this.formatNumber(highlights.best_category_amount)}`,
      riskCategory: risk || "-",
      riskCategoryAmount: `￥${this.formatNumber(highlights.risk_category_amount)}`
    };
  },
  drawTrendChart() {
    const trend = this.data.trend;
    const ctx = wx.createCanvasContext("trendChart", this);
    const query = wx.createSelectorQuery().in(this);
    query.select("#trendCanvas").boundingClientRect((rect) => {
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const innerWidth = width - padding * 2;
      const innerHeight = height - padding * 2;

      ctx.setFillStyle("rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, width, height);

      if (!trend || trend.length === 0) {
        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(14);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText("暂无趋势数据", width / 2, height / 2);
        ctx.draw();
        return;
      }

      const values = trend.map((item) => Number(item.net_worth || 0));
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const range = maxValue - minValue || 1;

      const points = trend.map((item, index) => {
        const value = Number(item.net_worth || 0);
        const x = padding + (index / Math.max(trend.length - 1, 1)) * innerWidth;
        const y = padding + (1 - (value - minValue) / range) * innerHeight;
        return { x, y };
      });

      // Axis
      ctx.setStrokeStyle("rgba(255,255,255,0.15)");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();

      // Area fill
      ctx.setFillStyle("rgba(99,102,241,0.25)");
      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding);
      points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.setStrokeStyle("#818cf8");
      ctx.setLineWidth(3);
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();

      // Dots
      ctx.setFillStyle("#c7d2fe");
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.draw();
    }).exec();
  },
  drawCashflowChart() {
    const cashflow = this.data.cashflow;
    const ctx = wx.createCanvasContext("cashflowChart", this);
    const query = wx.createSelectorQuery().in(this);
    query.select("#cashflowCanvas").boundingClientRect((rect) => {
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const chartHeight = height - padding * 2;
      const axisY = padding + chartHeight / 2;
      const barWidth = Math.max(12, (width - padding * 2) / Math.max(cashflow.length, 1) - 10);

      ctx.setFillStyle("rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, width, height);

      if (!cashflow || cashflow.length === 0) {
        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(14);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText("暂无现金流数据", width / 2, height / 2);
        ctx.draw();
        return;
      }

      const maxValue = Math.max(
        ...cashflow.map((item) => Math.max(Number(item.inflow || 0), Number(item.outflow || 0)))
      ) || 1;
      const scale = (chartHeight / 2) / maxValue;

      // Axis line
      ctx.setStrokeStyle("rgba(255,255,255,0.2)");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding, axisY);
      ctx.lineTo(width - padding, axisY);
      ctx.stroke();

      cashflow.forEach((item, index) => {
        const inflow = Number(item.inflow || 0);
        const outflow = Number(item.outflow || 0);
        const x = padding + index * (barWidth + 10) + barWidth / 2;

        const inflowHeight = inflow * scale;
        const outflowHeight = outflow * scale;

        ctx.setFillStyle("#22c55e");
        ctx.fillRect(
          x - barWidth / 2,
          axisY - inflowHeight,
          barWidth / 2 - 2,
          inflowHeight
        );

        ctx.setFillStyle("#ef4444");
        ctx.fillRect(
          x + 2,
          axisY,
          barWidth / 2 - 2,
          outflowHeight
        );

        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(12);
        ctx.setTextAlign("center");
        ctx.fillText(this.getDateLabel(item.date), x, height - 8);
      });

      ctx.draw();
    }).exec();
  },
  getDateLabel(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    return `${parts[1]}/${parts[2]}`;
  },
  formatNumber(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return "0.00";
    return num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },
  formatSignedNumber(value) {
    const num = Number(value || 0);
    const formatted = this.formatNumber(num);
    if (num > 0) return `+${formatted}`;
    if (num < 0) return `-${this.formatNumber(Math.abs(num))}`;
    return formatted;
  },
  onPullDownRefresh() {
    this.fetchAnalytics().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
