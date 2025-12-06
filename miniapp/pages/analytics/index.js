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
    if (!app?.globalData?.token) {
      app.globalData.guest = true;
    }
    this.setData({ needLogin: false });
    this.fetchAnalytics();
  },
  onShow() {
    const app = getApp();
    if (!app?.globalData?.token) app.globalData.guest = true;
    if (this.data.needLogin) this.setData({ needLogin: false });
    this.fetchAnalytics(true);
  },

  async fetchAnalytics(quiet = false) {
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
          this.fetchCashflowDistribution();
        }
      );
      try {
        const monthlyRes = await api.fetchMonthlyAnalytics(12);
        this.setData({ monthly: monthlyRes.points || [] }, () => {
          this.drawMonthlyCharts();
          this.updateIncomeExpenseTrends();
        });
      } catch (e2) {
        this.setData({ monthly: [] }, () => { this.drawMonthlyCharts(); this.updateIncomeExpenseTrends(); });
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
  async fetchCashflowDistribution() {
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const start = this.formatDate(startDate);
      const end = this.formatDate(endDate);
      const query = { start, end, planned: true };
      let list = [];
      try { list = await api.listCashflows(query); } catch (e) { list = []; }

      const rangeStart = start ? new Date(String(start).replace(/-/g, "/")) : null;
      const rangeEnd = end ? new Date(String(end).replace(/-/g, "/")) : null;
      const inRange = (ds) => {
        if (!rangeStart || !rangeEnd) return true;
        const d = new Date(String(ds).replace(/-/g, "/"));
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
            pushPayment(acc, y, m, d);
            return;
          }
          const s = new Date(String(startStr).replace(/-/g, "/"));
          const dueDay = s.getDate();
          let y = rangeStart.getFullYear();
          let m = rangeStart.getMonth() + 1;
          while (true) {
            const d = clampDay(y, m, dueDay);
            const cand = new Date(y, m - 1, d);
            if (cand < s) { m += 1; if (m > 12) { m = 1; y += 1; } continue; }
            if (cand > rangeEnd) break;
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
              recurringSynthExpense.push({ id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`, type: 'expense', category: t.category || '其他支出', amount: Number(t.amount || 0), date: dt, planned: true });
            }
          });
      } catch (e) { recurringSynthExpense = []; }

      const recorded = (list || []).map(x => ({ type: x.type, category: x.category, amount: Number(x.amount || 0), planned: !!x.planned }));
      const combinedAll = [...recorded, ...rents, ...assetIncomes, ...debts, ...designServiceIncome, ...recurringSynth, ...recurringSynthExpense];
      const incomeItems = combinedAll.filter(i => i.type === 'income');
      const expenseItems = combinedAll.filter(i => i.type === 'expense');
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
        api.fetchWealthSummary(rng.start, rng.end, 'month')
      ]).then(([list, sumRes]) => {
        const income = (list || []).reduce((sum, x) => sum + (x && x.type === 'income' && !!x.planned ? Number(x.amount || 0) : 0), 0);
        const expense = Number(sumRes && sumRes.expected_expense ? sumRes.expected_expense : 0);
        return { income, expense, y: rng.y, m: rng.m };
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
      if (r.y === cy && r.m === cm) {
        try {
          let cached = null;
          try { cached = wx.getStorageSync('fw_design_service_stats_month'); } catch (e2) { cached = null; }
          const fresh = cached && cached.data && cached.data.success && (Date.now() - (cached.ts || 0) < 5 * 60 * 1000);
          let total = 0;
          if (fresh) {
            total = Number(cached.data.data?.total_revenue || 0);
          } else {
            const stats = await api.getFinanceStats('month');
            if (stats.success) total = Number(stats.data.total_revenue || 0);
            try { wx.setStorageSync('fw_design_service_stats_month', { data: stats, ts: Date.now() }); } catch (e3) {}
          }
          results[i].income += total;
          try {
            const startDate = new Date(cy, cm - 1, 1);
            const endDate = new Date(cy, cm, 0);
            const start = this.formatDate(startDate);
            const end = this.formatDate(endDate);
            const inRange = (ds) => {
              if (!start || !end) return true;
              const d = new Date(String(ds).replace(/-/g, "/"));
              const s = new Date(String(start).replace(/-/g, "/"));
              const e = new Date(String(end).replace(/-/g, "/"));
              return d >= s && d <= e;
            };
            let reminders = [];
            let assets = [];
            try {
              const res = await Promise.all([
                api.listRentReminders(45),
                api.listAccounts("asset")
              ]);
              reminders = res[0] || [];
              assets = res[1] || [];
            } catch (err1) {
              try {
                const res2 = await Promise.all([
                  api.listRentReminders(90),
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
            let expectedRentIncomeSum = 0;
            const rentedAssetIds = new Set();
            (reminders || []).forEach((r0) => {
              if (inRange(r0.next_due_date)) {
                expectedRentIncomeSum += Number(r0.monthly_rent || 0);
                if (r0.account_id) rentedAssetIds.add(Number(r0.account_id));
              }
            });
            let assetMonthlyIncomeSum = 0;
            (assets || []).forEach((acc) => {
              if (!rentedAssetIds.has(Number(acc.id))) {
                const mi = Number(acc.monthly_income || 0);
                if (mi > 0) assetMonthlyIncomeSum += mi;
              }
            });
            results[i].income += (expectedRentIncomeSum + assetMonthlyIncomeSum);
          } catch (errx) {}

          try {
            const startDate = new Date(cy, cm - 1, 1);
            const endDate = new Date(cy, cm, 0);
            const start = this.formatDate(startDate);
            const end = this.formatDate(endDate);
            const sel = 'month';
            const sumRes = await api.fetchWealthSummary(start, end, sel);
            const exp = Number(sumRes && sumRes.expected_expense ? sumRes.expected_expense : 0);
            results[i].expense = exp;
          } catch (eExp) {}
        } catch (e4) {}
      }
    }
    const incomeSeries = results.map(r => Number(r.income || 0));
    const expenseSeries = results.map(r => Number(r.expense || 0));
    const labels = months.map(p => this.getMonthLabel(p.month));
    this.setData({ incomeTrendSeries: incomeSeries, expenseTrendSeries: expenseSeries, incomeTrendLabels: labels, expenseTrendLabels: labels }, () => {
      this.drawIncomeTrend();
      this.drawExpenseTrend();
    });
  },
  calculateCashflowDistribution(items = [], kind = 'income') {
    const buckets = {};
    (items || []).forEach(i => {
      const cat = String(i.category || (kind === 'income' ? '其他收入' : '其他支出'));
      const amt = Number(i.amount || 0);
      if (amt <= 0) return;
      buckets[cat] = (buckets[cat] || 0) + amt;
    });
    const entries = Object.keys(buckets).map(name => ({ name, value: buckets[name] }));
    entries.sort((a, b) => b.value - a.value);
    if (!entries.length) return [];
    const MAX_SEGMENTS = 6;
    let processed = entries.slice();
    if (entries.length > MAX_SEGMENTS) {
      const major = entries.slice(0, MAX_SEGMENTS - 1);
      const others = entries.slice(MAX_SEGMENTS - 1);
      const othersValue = others.reduce((sum, item) => sum + item.value, 0);
      processed = [...major, { name: kind === 'income' ? '其他收入' : '其他支出', value: othersValue }];
    }
    const total = processed.reduce((sum, item) => sum + item.value, 0) || 1;
    const paletteIncome = ["#43B176", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#22c55e"];
    const paletteExpense = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4"];
    const palette = kind === 'income' ? paletteIncome : paletteExpense;
    return processed.map((item, idx) => ({
      name: item.name,
      value: item.value,
      percentage: ((item.value / total) * 100).toFixed(1),
      color: palette[idx % palette.length]
    }));
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
      if (!data.length || data.every(x => Number(x.value) <= 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
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
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.closePath();
        ctx.fill();
        currentAngle += angle;
      });
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
      if (!data.length || data.every(x => Number(x.value) <= 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
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
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.closePath();
        ctx.fill();
        currentAngle += angle;
      });
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
        const padL = 40, padR = 16, padT = 16, padB = 24;
        const iw = w - padL - padR, ih = h - padT - padB;
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
        if (!series || series.length === 0 || series.every(v => Number(v) <= 0)) { drawEmpty('暂无收入趋势'); return; }
        const maxVal = Math.max(...series);
        const minVal = 0;
        const range = (maxVal - minVal) || 1;
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
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < series.length; i++) {
          const pt = toXY(i);
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
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
        this._incomeTrendMeta = { padL, padR, padT, padB, iw, ih, w, h, rect, series, labels, minVal, range, xs };
        const sel = typeof this._incomeTrendSelectedIdx === 'number' ? this._incomeTrendSelectedIdx : -1;
        if (sel >= 0 && sel < series.length) {
          const x = xs[sel];
          const y = padT + (1 - ((series[sel] - minVal) / (range || 1))) * ih;
          ctx.strokeStyle = 'rgba(17,24,39,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padT);
          ctx.lineTo(x, h - padB);
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
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
          ctx.fillStyle = '#22c55e';
          ctx.fillText(`收入 ${this.formatAxisValue(series[sel])}`, bx + 8, by + 26);
        }
      });
    });
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
        const padL = 40, padR = 16, padT = 16, padB = 24;
        const iw = w - padL - padR, ih = h - padT - padB;
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
    if (!inside) {
      this._incomeTrendSelectedIdx = -1;
      this.drawIncomeTrend();
      return;
    }
    const xs = meta.xs || new Array(meta.series.length).fill(0).map((_, i) => meta.padL + (i / Math.max(meta.series.length - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }
    this._incomeTrendSelectedIdx = idx;
    this.drawIncomeTrend();
  },
  onExpenseTrendTouch(e) {
    const meta = this._expenseTrendMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = (typeof touch.x === 'number') ? touch.x : ((touch.clientX || 0) - (meta.rect.left || 0));
    const localY = (typeof touch.y === 'number') ? touch.y : ((touch.clientY || 0) - (meta.rect.top || 0));
    const inside = localX >= meta.padL && localX <= meta.padL + meta.iw && localY >= meta.padT && localY <= meta.padT + meta.ih;
    if (!inside) {
      this._expenseTrendSelectedIdx = -1;
      this.drawExpenseTrend();
      return;
    }
    const xs = meta.xs || new Array(meta.series.length).fill(0).map((_, i) => meta.padL + (i / Math.max(meta.series.length - 1, 1)) * meta.iw);
    let idx = 0, best = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(localX - xs[i]);
      if (d < best) { best = d; idx = i; }
    }
    this._expenseTrendSelectedIdx = idx;
    this.drawExpenseTrend();
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
          const padL = 48, padR = 20, padT = 16, padB = 26;
          const iw1 = w1 - padL - padR, ih1 = h1 - padT - padB;
          const iw2 = w2 - padL - padR, ih2 = h2 - padT - padB;

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
    const v = Math.abs(Number(value || 0));
    const sign = Number(value || 0) < 0 ? '-' : '';
    if (v >= 1e8) return `${sign}${(v / 1e8).toFixed(1)}亿`;
    if (v >= 1e4) return `${sign}${(v / 1e4).toFixed(1)}万`;
    return `${sign}${Math.round(v)}`;
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
    return (list || []).map((item) => ({
      ...item,
      amountText: `￥${this.formatNumber(item.amount)}`,
      percentageText: `${Number(item.percentage || 0).toFixed(2)}%`,
      barClass: type === "asset" ? "asset-bar" : "liability-bar",
      icon: type === "asset" ? getAssetCategoryIcon(item.category) : getLiabilityCategoryIcon(item.category)
    }));
  },
  formatHighlights(highlights) {
    return {
      bestCategory: highlights.best_category || "-",
      bestCategoryAmount: `￥${this.formatNumber(highlights.best_category_amount)}`,
      riskCategory: highlights.risk_category || "-",
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
