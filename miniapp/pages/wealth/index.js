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
  "保险": "bill-line-red.svg",
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
    pageTabs: [
      { label: "预算", value: "budget" },
      { label: "决算", value: "final" }
    ],
    activePage: "budget",
    rangeTabs: [
      { label: "本月", value: "month" },
      { label: "本年", value: "year" },
      { label: "全部", value: "all" }
    ],
    activeRange: "month",
    rangeLabelPrefix: "本月",
    selectedYear: 0,
    selectedMonth: 0,
    monthSelectorRange: [[], []],
    monthSelectorIndex: [0, 0],
    yearSelectorRange: [],
    yearSelectorIndex: 0,
    summary: {
      expectedExpense: "0.00",
      expectedIncome: "0.00",
      actualExpense: "0.00",
      actualIncome: "0.00",
      netIncome: "0.00",
      netIncomePositive: true,
      netActualIncome: "0.00",
      netActualPositive: true,
      incomeExpenseRatio: "0.00"
    },
    summaryReady: true,
    typeTabs: [
      { label: "全部", value: "all" },
      { label: "收入", value: "income" },
      { label: "支出", value: "expense" }
    ],
    activeType: "all",
    cashflows: [],
    swipeLock: false,
    listTitle: "预算记录"
  },
  _parseCycle(note) {
    const s = String(note || '');
    if (/\[周期:每月\]/.test(s)) return 'monthly';
    if (/\[周期:每季度\]/.test(s)) return 'quarterly';
    if (/\[周期:每半年\]/.test(s)) return 'halfyear';
    if (/\[周期:每年\]/.test(s)) return 'year';
    return null;
  },
  _isCycleHit(y, m, startDate, cycle) {
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) return false;
    if (!cycle) return false;
    const startY = startDate.getFullYear();
    const startM = startDate.getMonth() + 1;
    const diff = (y - startY) * 12 + (m - startM);
    if (diff < 0) return false;
    if (cycle === 'monthly') return true;
    if (cycle === 'quarterly') return diff % 3 === 0;
    if (cycle === 'halfyear') return diff % 6 === 0;
    if (cycle === 'year') return diff % 12 === 0;
    return false;
  },
  handlePageSwitch(e) {
    const val = String(e.currentTarget.dataset.value || "budget");
    if (val === this.data.activePage) return;
    const lt = val === 'final' ? '决算记录' : '预算记录';
    this.setData({ activePage: val, listTitle: lt }, () => {
      this.fetchSummary(false);
      this.fetchList(false);
    });
  },
  setFilteredList(list) {
    this.fullList = list || [];
    this.renderList();
  },
  renderList() {
    const list = this.fullList || [];
    const wantPlanned = this.data.activePage !== 'final';
    const filtered = list.filter((item) => {
      if (item.planned === undefined || item.planned === null) return true;
      return wantPlanned ? !!item.planned : !item.planned;
    });
    this.setData({ cashflows: filtered });
  },
  handleRangeTab(e) {
    const val = String(e.currentTarget.dataset.value || "month");
    if (val === this.data.activeRange) return;
    const prefix = val === 'year' ? '本年' : (val === 'all' ? '全部' : '本月');
    const baseY = this.data.selectedYear || new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => String(baseY - 10 + i));
    const yi = Math.max(0, years.findIndex(v => Number(v) === baseY));
    const lt = this.data.activePage === 'final' ? '决算记录' : '预算记录';
    this.setData({ activeRange: val, rangeLabelPrefix: prefix, yearSelectorRange: years, yearSelectorIndex: yi, listTitle: lt }, () => {
      this.fetchSummary(false);
      this.fetchList(false);
    });
  },
  handleSwipeStart(e) {
    const t = (e && (e.changedTouches && e.changedTouches[0])) || (e && (e.touches && e.touches[0])) || {};
    this._swipeStartX = Number(t.pageX || t.clientX || 0);
    this._swipeStartY = Number(t.pageY || t.clientY || 0);
    this._swipeStartTime = Date.now();
    this.setData({ swipeLock: false });
  },
  handleSwipeMove(e) {
    const t = (e && (e.changedTouches && e.changedTouches[0])) || (e && (e.touches && e.touches[0])) || {};
    const endX = Number(t.pageX || t.clientX || 0);
    const endY = Number(t.pageY || t.clientY || 0);
    const dx = endX - (this._swipeStartX || 0);
    const dy = endY - (this._swipeStartY || 0);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > 20 && absX > absY * 1.2) {
      if (!this.data.swipeLock) this.setData({ swipeLock: true });
    } else {
      if (this.data.swipeLock) this.setData({ swipeLock: false });
    }
  },
  handleSwipeEnd(e) {
    const t = (e && (e.changedTouches && e.changedTouches[0])) || (e && (e.touches && e.touches[0])) || {};
    const endX = Number(t.pageX || t.clientX || 0);
    const endY = Number(t.pageY || t.clientY || 0);
    const dx = endX - (this._swipeStartX || 0);
    const dy = endY - (this._swipeStartY || 0);
    const dt = Date.now() - (this._swipeStartTime || 0);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (dt > 800) return;
    if (absX < 60) return;
    if (absX < absY * 1.2) return;
    if (dx < 0) {
      this.nextMonth();
    } else {
      this.prevMonth();
    }
    this.setData({ swipeLock: false });
  },
  handleSwipeCancel() {
    this.setData({ swipeLock: false });
  },
  handleMaskMove() {},
  onTabItemTap() {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const years = Array.from({ length: 11 }, (_, i) => String(y - 10 + i));
      const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
      const yi = Math.max(0, years.findIndex(v => Number(v) === y));
      const mi = Math.max(0, months.findIndex(v => Number(v) === m));
    const lt = this.data.activePage === 'final' ? '决算记录' : '预算记录';
    this.setData({
      selectedYear: y,
      selectedMonth: m,
      monthSelectorRange: [years, months],
      monthSelectorIndex: [yi, mi],
      activeType: 'all',
      yearSelectorRange: years,
      yearSelectorIndex: yi,
      listTitle: lt
    }, () => {
      try { wx.setStorageSync('fw_period', { y, m }); } catch (e) {}
      this.fetchSummary(false);
      this.fetchList(false);
    });
    } catch (e) {}
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
    let saved = null;
    try { saved = wx.getStorageSync('fw_period'); } catch (e) { saved = null; }
    const now = new Date();
    const y = Number(saved?.y || 0) || now.getFullYear();
    const m = Number(saved?.m || 0) || (now.getMonth() + 1);
    const years = Array.from({ length: 11 }, (_, i) => String(y - 10 + i));
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const yi = Math.max(0, years.findIndex(v => Number(v) === y));
    const mi = Math.max(0, months.findIndex(v => Number(v) === m));
    const lt2 = this.data.activePage === 'final' ? '决算记录' : '预算记录';
    this.setData({
      selectedYear: y,
      selectedMonth: m,
      monthSelectorRange: [years, months],
      monthSelectorIndex: [yi, mi],
      yearSelectorRange: years,
      yearSelectorIndex: yi,
      listTitle: lt2
    });
    this.skipFilterOnce = true;
    let cached = null;
    try { cached = wx.getStorageSync('fw_summary_cache'); } catch (e) {}
    const prefix = (this.data.activeRange === 'year') ? '本年' : (this.data.activeRange === 'all' ? '全部' : '本月');
    this.setData({ summaryReady: true, activeType: this.data.activeType || 'all', rangeLabelPrefix: prefix }, () => {
      this.fetchSummary(false);
      this.fetchList(false);
    });
  },
  prevMonth() {
    if (this._navLock) return;
    this._navLock = true;
    setTimeout(() => { this._navLock = false; }, 300);
    let y = this.data.selectedYear;
    let m = this.data.selectedMonth - 1;
    if (m < 1) { m = 12; y -= 1; }
    const yearsArr = this.data.monthSelectorRange[0] || [];
    const monthsArr = this.data.monthSelectorRange[1] || Array.from({ length: 12 }, (_, i) => String(i + 1));
    let useYears = yearsArr;
    if (!yearsArr.some(v => Number(v) === y)) {
      useYears = Array.from({ length: 11 }, (_, i) => String(y - 10 + i));
    }
    const yi = Math.max(0, useYears.findIndex(v => Number(v) === y));
    const mi = m - 1;
    this.setData({ selectedYear: y, selectedMonth: m, monthSelectorRange: [useYears, monthsArr], monthSelectorIndex: [yi, mi] }, () => { try { wx.setStorageSync('fw_period', { y, m }); } catch (e) {} this.fetchSummary(false); this.fetchList(false); });
  },
  prevYear() {
    if (this._navLock) return;
    this._navLock = true;
    setTimeout(() => { this._navLock = false; }, 300);
    let y = this.data.selectedYear - 1;
    const yearsArr = this.data.yearSelectorRange || [];
    let useYears = yearsArr;
    if (!yearsArr.some(v => Number(v) === y)) {
      useYears = Array.from({ length: 11 }, (_, i) => String(y - 10 + i));
    }
    const yi = Math.max(0, useYears.findIndex(v => Number(v) === y));
    this.setData({ selectedYear: y, yearSelectorRange: useYears, yearSelectorIndex: yi }, () => { try { wx.setStorageSync('fw_period', { y, m: this.data.selectedMonth }); } catch (e) {} this.fetchSummary(false); this.fetchList(false); });
  },
  nextYear() {
    if (this._navLock) return;
    this._navLock = true;
    setTimeout(() => { this._navLock = false; }, 300);
    let y = this.data.selectedYear + 1;
    const yearsArr = this.data.yearSelectorRange || [];
    let useYears = yearsArr;
    if (!yearsArr.some(v => Number(v) === y)) {
      useYears = Array.from({ length: 11 }, (_, i) => String(y - 10 + i));
    }
    const yi = Math.max(0, useYears.findIndex(v => Number(v) === y));
    this.setData({ selectedYear: y, yearSelectorRange: useYears, yearSelectorIndex: yi }, () => { try { wx.setStorageSync('fw_period', { y, m: this.data.selectedMonth }); } catch (e) {} this.fetchSummary(false); this.fetchList(false); });
  },
  handleYearSelectorChange(e) {
    const idx = Number(e.detail.value || 0);
    const years = this.data.yearSelectorRange || [];
    const y = Number(years[idx] || this.data.selectedYear);
    this.setData({ selectedYear: y, yearSelectorIndex: idx }, () => { try { wx.setStorageSync('fw_period', { y, m: this.data.selectedMonth }); } catch (e) {} this.fetchSummary(false); this.fetchList(false); });
  },
  nextMonth() {
    if (this._navLock) return;
    this._navLock = true;
    setTimeout(() => { this._navLock = false; }, 300);
    let y = this.data.selectedYear;
    let m = this.data.selectedMonth + 1;
    if (m > 12) { m = 1; y += 1; }
    const yearsArr = this.data.monthSelectorRange[0] || [];
    const monthsArr = this.data.monthSelectorRange[1] || Array.from({ length: 12 }, (_, i) => String(i + 1));
    let useYears = yearsArr;
    if (!yearsArr.some(v => Number(v) === y)) {
      useYears = Array.from({ length: 11 }, (_, i) => String(y - 10 + i));
    }
    const yi = Math.max(0, useYears.findIndex(v => Number(v) === y));
    const mi = m - 1;
    this.setData({ selectedYear: y, selectedMonth: m, monthSelectorRange: [useYears, monthsArr], monthSelectorIndex: [yi, mi] }, () => { try { wx.setStorageSync('fw_period', { y, m }); } catch (e) {} this.fetchSummary(false); this.fetchList(false); });
  },
  handlePeriodMultiChange(e) {
    const idx = e.detail.value || [0,0];
    const years = this.data.monthSelectorRange[0] || [];
    const months = this.data.monthSelectorRange[1] || [];
    const y = Number(years[idx[0]] || this.data.selectedYear);
    const m = Number(months[idx[1]] || this.data.selectedMonth);
    this.setData({ selectedYear: y, selectedMonth: m, monthSelectorIndex: idx }, () => { try { wx.setStorageSync('fw_period', { y, m }); } catch (e) {} this.fetchSummary(false); this.fetchList(false); });
  },
  async fetchSummary(skipIncomeUpdate = false) {
    const range = this.data.activeRange || 'month';
    const y = this.data.selectedYear || new Date().getFullYear();
    const m = this.data.selectedMonth || (new Date().getMonth() + 1);
    let start = undefined;
    let end = undefined;
    if (range === 'month') {
      const endDate = new Date(y, m, 0);
      end = this.formatDate(endDate);
      start = this.formatDate(new Date(y, m - 1, 1));
    } else if (range === 'year') {
      start = `${y}-01-01`;
      end = `${y}-12-31`;
    } else {
      start = undefined;
      end = undefined;
    }
    try {
      const res = await api.fetchWealthSummary(start, end, range);
      let designServiceIncome = 0;
      try {
        const app = getApp();
        if (!app?.globalData?.token || app.globalData.guest) {
          designServiceIncome = 0;
        } else {
          const isCurrentMonth = (y === new Date().getFullYear() && m === (new Date().getMonth() + 1));
          const monthStr = `${y}-${String(m).padStart(2, '0')}`;
          const cacheKey = `fw_design_service_stats_month:${monthStr}`;
          let cached = null;
          try { cached = wx.getStorageSync(cacheKey); } catch (e) { cached = null; }
          const fresh = cached && cached.data && cached.data.success && (Date.now() - (cached.ts || 0) < 5 * 60 * 1000);
          if (fresh) {
            designServiceIncome = Number(cached.data.data?.total_revenue || 0);
          } else {
            const stats = isCurrentMonth ? await api.getFinanceStats('month') : await api.getFinanceStats('month', monthStr);
            if (stats.success) {
              designServiceIncome = Number(stats.data.total_revenue || 0);
              try { wx.setStorageSync(cacheKey, { data: stats, ts: Date.now() }); } catch (e) {}
            }
          }
        }
      } catch (err) {}
      try {
        const app = getApp();
        if (range === 'month' && app?.globalData?.token && !app.globalData.guest) {
          await api.saveMonthlySnapshot(y, m, designServiceIncome);
        }
      } catch (eSnap) {}

      const res2 = await api.fetchWealthSummary(start, end, range);
      let actExp = Number(res2.actual_expense || 0);
      let actInc = Number(res2.actual_income || 0);
      let expExpNum = Number(res2.expected_expense || 0);
      let expIncNum = Number(res2.expected_income || 0);
      if (range !== 'month') {
        try {
          const agg = await api.aggregatePlanned(start, end, range);
          expExpNum = Number(agg?.expense_total || 0);
          expIncNum = Number(agg?.income_total || 0);
        } catch (eAgg) {}
      }
      const netExpected = expIncNum - expExpNum;
      const netPositive = netExpected >= 0;
      const netActual = actInc - actExp;
      const netActualPositive = netActual >= 0;
      const ratioDisplay = expExpNum > 0 ? `${Math.round((expIncNum / expExpNum) * 100)}%` : '—';
      const quickSummary = {
        expectedExpense: this.formatNumber(expExpNum),
        expectedIncome: this.formatNumber(expIncNum),
        actualExpense: this.formatNumber(actExp),
        actualIncome: this.formatNumber(actInc),
        netIncome: this.formatNumber(netExpected),
        netIncomePositive: netPositive,
        netActualIncome: this.formatNumber(netActual),
        netActualPositive: netActualPositive,
        incomeExpenseRatio: ratioDisplay
      };
      this.setData({ summary: quickSummary, summaryReady: true });
      try { wx.setStorageSync('fw_summary_cache', this.data.summary); } catch (e) {}
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
    const fetchId = Date.now();
    this._lastFetchId = fetchId;
    const range = this.data.activeRange || 'month';
    const y = this.data.selectedYear || new Date().getFullYear();
    const m = this.data.selectedMonth || (new Date().getMonth() + 1);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    const query = { };
    if (range === 'month') {
      query.end = end;
      if (start) query.start = start;
    } else if (range === 'year') {
      query.start = `${y}-01-01`;
      query.end = `${y}-12-31`;
    }
    if (!forceAll && !this.skipFilterOnce && this.data.activeType !== "all") query.type = this.data.activeType;
    try {
      let list = [];
      if (range === 'month') {
        // 优先使用后端统一接口（按月），包含实际项
        try {
          list = await api.listPlannedItemsRange(start, end, 'month', (this.data.activeType !== 'all' ? this.data.activeType : undefined), true);
        } catch (eUnified) {
          list = [];
        }
        if (!Array.isArray(list) || list.length === 0) {
          try { list = await api.listCashflows({ end, start, ...(query.type ? { type: query.type } : {}) }); } catch (e0) { list = []; }
        }
      } else {
        try { list = await api.listCashflows(query); } catch (e0) { list = []; }
      }
      if (this._lastFetchId !== fetchId) return;

      const normalized = (arr) => (arr || []).map((x, i) => ({ ...x, id: x.id || `${x.type || 'unknown'}:${x.planned ? 'planned' : 'actual'}:${x.category}:${x.date}:${i}` }));
      const mergedRaw = [...normalized(list)];
      let formatted = mergedRaw.map((x) => {
        const idStr = String(x.id || '');
        const isAssetIncome = (x._synthetic === 'asset-income') || idStr.startsWith('asset-income:');
        const isLoan = (x._synthetic === 'loan') || idStr.startsWith('loan:');
        const title = (isAssetIncome || isLoan) && x.account_name ? x.account_name : (x.name ? x.name : (x.note ? x.note : x.category));
        return {
          ...x,
          amount: x.amount,
          name: title,
          icon: getCategoryIcon(x.category, x.type)
        };
      });
      const unifiedOk = (range === 'month') && Array.isArray(list) && list.length > 0 && String(list[0]?.id || '').length > 0;
      if (unifiedOk) {
        const activeType = this.data.activeType;
        let assets = [];
        let liabilities = [];
        try {
          [assets, liabilities] = await Promise.all([api.listAccounts('asset'), api.listAccounts('liability')]);
        } catch (eAcc) { assets = []; liabilities = []; }
        const assetEndMap = Object.create(null);
        const liabEndMap = Object.create(null);
        const assetStartMap = Object.create(null);
        const liabStartMap = Object.create(null);
        (assets || []).forEach(a => { assetEndMap[Number(a.id)] = a.invest_end_date || ''; assetStartMap[Number(a.id)] = a.invest_start_date || ''; });
        (liabilities || []).forEach(l => { liabEndMap[Number(l.id)] = l.loan_end_date || ''; liabStartMap[Number(l.id)] = l.loan_start_date || ''; });
        const enriched = formatted.map(it => {
          const idStr = String(it.id || '');
          let endDate = it.end_date || '';
          let startDate = it.recurring_start_date || '';
          if (!endDate) {
            if ((it._synthetic === 'asset-income') || idStr.startsWith('asset-income:')) {
              endDate = assetEndMap[Number(it.account_id)] || '';
            } else if ((it._synthetic === 'loan-payment') || idStr.startsWith('loan:')) {
              endDate = liabEndMap[Number(it.account_id)] || '';
            }
          }
          if (!startDate) {
            if ((it._synthetic === 'asset-income') || idStr.startsWith('asset-income:')) {
              startDate = assetStartMap[Number(it.account_id)] || '';
            } else if ((it._synthetic === 'loan-payment') || idStr.startsWith('loan:')) {
              startDate = liabStartMap[Number(it.account_id)] || '';
            }
          }
          return { ...it, end_date: endDate, recurring_start_date: startDate };
        });
        const combinedAll = enriched.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        let combined = (forceAll || this.skipFilterOnce) ? combinedAll : combinedAll.filter((x) => activeType === 'all' || x.type === activeType);
        if (activeType !== 'all' && combined.length === 0 && combinedAll.length > 0) {
          combined = combinedAll;
        }
        if (this._lastFetchId !== fetchId) return;
        this.setFilteredList(combined);
        this.skipFilterOnce = false;
        return;
      }
      

      if (range !== 'month') {
        const typeFilter = this.data.activeType !== 'all' ? this.data.activeType : undefined;
        let startStr, endStr;
        if (range === 'year') {
          startStr = `${y}-01-01`;
          endStr = `${y}-12-31`;
        }
        if (range === 'all') {
          let rawAll = [];
          try { 
            // include_actual = true
            rawAll = await api.aggregatePlannedItems(undefined, undefined, 'all', typeFilter, true); 
          } catch (eAll) { rawAll = []; }
          const formattedAll = (rawAll || [])
            .map((x) => ({
              ...x,
              amount: this.formatNumber(x.amount),
              name: x.name ? x.name : (x.note ? x.note : x.category),
              icon: getCategoryIcon(x.category, x.type)
            }))
            .sort((a, b) => Number(String(b.amount).replace(/,/g, '')) - Number(String(a.amount).replace(/,/g, '')));
          if (this._lastFetchId !== fetchId) return;
          this.setFilteredList(formattedAll);
          this.skipFilterOnce = false;
          return;
        }
        let raw = [];
        try { raw = await api.aggregatePlannedItems(startStr, endStr, range, typeFilter, true); } catch (e0) { raw = []; }
        let formatted = (raw || [])
          .map((x) => ({
            ...x,
            amount: this.formatNumber(x.amount),
            name: x.name ? x.name : (x.note ? x.note : x.category),
            icon: getCategoryIcon(x.category, x.type)
          }))
          .sort((a, b) => Number(String(b.amount).replace(/,/g, '')) - Number(String(a.amount).replace(/,/g, '')));
        if (range === 'year' && (!typeFilter || typeFilter === 'income')) {
          try {
            const statsYear = await api.getFinanceStats('year', String(y));
            if (statsYear && statsYear.success) {
              const totalYear = Number(statsYear.data?.total_revenue || 0);
              if (totalYear > 0) {
                formatted.push({
                  id: `design-service-income:year:${y}`,
                  type: 'income',
                  category: '设计服务',
                  amount: this.formatNumber(totalYear),
                  name: '设计服务',
                  icon: getCategoryIcon('设计服务', 'income')
                });
                formatted = formatted.sort((a, b) => Number(String(b.amount).replace(/,/g, '')) - Number(String(a.amount).replace(/,/g, '')));
              }
            }
          } catch (eYear) {}
        }
        if (this._lastFetchId !== fetchId) return;
        this.setFilteredList(formatted);
        this.skipFilterOnce = false;
        return;
      }
      // 自动生成本月缺失的每月重复收入（例如工资）
      let recurringSynth = [];
      const keyOf = (i) => `${i.type}:${i.category}:${i.note ? i.note : (i.name ? i.name : i.category)}`;
      try {
        const prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        const prevStart = this.formatDate(prevStartDate);
        const prevEnd = this.formatDate(prevEndDate);
        const prevQuery = { start: prevStart, end: prevEnd, type: 'income', planned: true };
        let prevList = [];
        try { prevList = await api.listCashflows(prevQuery); } catch (ePrev) { prevList = []; }
        const currKeysAny = new Set((formatted || []).map(i => keyOf(i)));
        const existingSynthIncomeKeys = new Set((recurringSynth || []).map(x => `${x.type}:${x.category}:${x.name}`));
        (prevList || [])
          .filter(i => i && i.type === 'income' && !!i.planned && !!i.recurring_monthly)
          .forEach(t => {
            const key = keyOf(t);
            if (!currKeysAny.has(key) && !existingSynthIncomeKeys.has(key)) {
              const prevDay = (() => { const d = new Date(String(t.date).replace(/-/g, '/')); return d.getDate(); })();
              const y = endDate.getFullYear();
              const m = endDate.getMonth() + 1;
              const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, prevDay)); })();
              const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
              recurringSynth.push({
                id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`,
                type: 'income',
                category: t.category || '其他收入',
                amount: this.formatNumber(t.amount),
                date: dt,
                planned: true,
                recurring_monthly: true,
                _synthetic: 'recurring-income',
                account_id: t.account_id,
                account_name: t.account_name,
                name: t.note ? t.note : (t.category || '收入'),
                icon: getCategoryIcon(t.category || '其他收入', 'income')
              });
            }
          });
        try {
          const y = endDate.getFullYear();
          const m = endDate.getMonth() + 1;
          const monthKey = `${y}${String(m).padStart(2, '0')}`;
          let allCf = [];
          try { allCf = await api.listCashflows({}); } catch (eAll) { allCf = []; }
          const recMasters = (allCf || []).filter(i => i && !!i.planned && (!!i.recurring_monthly || !!this._parseCycle(i.note)));
          const monthIndex = y * 12 + m;
          const toNum = (s) => { const n = Number(String(s).replace(/,/g, '')); return Number.isNaN(n) ? 0 : n; };
          const buildKey = (i) => `${i.type}:${i.category}:${i.note ? i.note : (i.name ? i.name : i.category)}`;
          recMasters.filter(i => i.type === 'income').forEach(ms => {
            const s = ms.recurring_start_date ? new Date(String(ms.recurring_start_date).replace(/-/g, '/')) : (ms.date ? new Date(String(ms.date).replace(/-/g, '/')) : null);
            if (!s || isNaN(s.getTime())) return;
            const e = ms.recurring_end_date ? new Date(String(ms.recurring_end_date).replace(/-/g, '/')) : null;
            const si = s.getFullYear() * 12 + (s.getMonth() + 1);
            if (monthIndex < si) return;
            if (e) {
              const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
              if (monthIndex > ei) return;
            }
            const key = buildKey(ms);
            if (currKeysAny.has(key)) return;
            if (existingSynthIncomeKeys.has(key)) return;
            const cyc = ms.recurring_monthly ? 'monthly' : this._parseCycle(ms.note);
            if (!cyc) return;
            if (!this._isCycleHit(y, m, s, cyc)) return;
            const baseDay = s.getDate();
            const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, baseDay)); })();
            const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
            recurringSynth.push({
              id: `recurring:db:${key}:${monthKey}`,
              type: 'income',
              category: ms.category || '其他收入',
              amount: this.formatNumber(toNum(ms.amount)),
              date: dt,
              planned: true,
              recurring_monthly: ms.recurring_monthly || false,
              _synthetic: 'recurring-income',
              recurring_start_date: ms.recurring_start_date || ms.date,
              recurring_end_date: ms.recurring_end_date || '',
              account_id: ms.account_id,
              account_name: ms.account_name,
              name: ms.note ? ms.note : (ms.category || '收入'),
              icon: getCategoryIcon(ms.category || '其他收入', 'income')
            });
            existingSynthIncomeKeys.add(key);
          });
          try {
            let skipStore = wx.getStorageSync('fw_recurring_skip');
            const arr = skipStore && typeof skipStore === 'object' ? (skipStore[monthKey] || []) : [];
            if (arr.length > 0) {
              recurringSynth = (recurringSynth || []).filter(x => !arr.includes(String(x.id)));
            }
          } catch (e2) {}
        } catch (e1) {}
      } catch (e) {}

      let recurringSynthExpense = [];
      try {
        const prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        const prevStart = this.formatDate(prevStartDate);
        const prevEnd = this.formatDate(prevEndDate);
        const prevQuery = { start: prevStart, end: prevEnd, type: 'expense', planned: true };
        let prevList = [];
        try { prevList = await api.listCashflows(prevQuery); } catch (ePrev) { prevList = []; }
        const currKeysAny = new Set((formatted || []).map(i => keyOf(i)));
        (prevList || [])
          .filter(i => i && i.type === 'expense' && !!i.planned && !!i.recurring_monthly)
          .forEach(t => {
            const key = keyOf(t);
            if (!currKeysAny.has(key)) {
              const prevDay = (() => { const d = new Date(String(t.date).replace(/-/g, '/')); return d.getDate(); })();
              const y = endDate.getFullYear();
              const m = endDate.getMonth() + 1;
              const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, prevDay)); })();
              const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
              recurringSynthExpense.push({
                id: `recurring:${t.id}:${y}${String(m).padStart(2, '0')}`,
                type: 'expense',
                category: t.category || '其他支出',
                amount: this.formatNumber(t.amount),
                date: dt,
                planned: true,
                recurring_monthly: true,
                _synthetic: 'recurring-expense',
                account_id: t.account_id,
                account_name: t.account_name,
                name: t.note ? t.note : (t.category || '支出'),
                icon: getCategoryIcon(t.category || '其他支出', 'expense')
              });
            }
          });
        try {
          const y = endDate.getFullYear();
          const m = endDate.getMonth() + 1;
          const monthKey = `${y}${String(m).padStart(2, '0')}`;
          let allCf = [];
          try { allCf = await api.listCashflows({}); } catch (eAll) { allCf = []; }
          const recMasters = (allCf || []).filter(i => i && !!i.planned && (!!i.recurring_monthly || !!this._parseCycle(i.note)));
          const monthIndex = y * 12 + m;
          const toNum = (s) => { const n = Number(String(s).replace(/,/g, '')); return Number.isNaN(n) ? 0 : n; };
          const buildKey = (i) => `${i.type}:${i.category}:${i.note ? i.note : (i.name ? i.name : i.category)}`;
          recMasters.filter(i => i.type === 'expense').forEach(ms => {
            const s = ms.recurring_start_date ? new Date(String(ms.recurring_start_date).replace(/-/g, '/')) : (ms.date ? new Date(String(ms.date).replace(/-/g, '/')) : null);
            if (!s || isNaN(s.getTime())) return;
            const e = ms.recurring_end_date ? new Date(String(ms.recurring_end_date).replace(/-/g, '/')) : null;
            const si = s.getFullYear() * 12 + (s.getMonth() + 1);
            if (monthIndex < si) return;
            if (e) {
              const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
              if (monthIndex > ei) return;
            }
            const key = buildKey(ms);
            const existsSynth = (recurringSynthExpense || []).some(x => `${x.type}:${x.category}:${x.name}` === key);
            if (existsSynth) return;
            if (currKeysAny.has(key)) return;
            const cyc = ms.recurring_monthly ? 'monthly' : this._parseCycle(ms.note);
            if (!cyc) return;
            if (!this._isCycleHit(y, m, s, cyc)) return;
            const baseDay = s.getDate();
            const dnum = (() => { const dim = new Date(y, m, 0).getDate(); return Math.min(dim, Math.max(1, baseDay)); })();
            const dt = `${y}-${String(m).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
            recurringSynthExpense.push({
              id: `recurring:db:${key}:${monthKey}`,
              type: 'expense',
              category: ms.category || '其他支出',
              amount: this.formatNumber(toNum(ms.amount)),
              date: dt,
              planned: true,
              recurring_monthly: ms.recurring_monthly || false,
              _synthetic: 'recurring-expense',
              recurring_start_date: ms.recurring_start_date || ms.date,
              recurring_end_date: ms.recurring_end_date || '',
              account_id: ms.account_id,
              account_name: ms.account_name,
              name: ms.note ? ms.note : (ms.category || '支出'),
              icon: getCategoryIcon(ms.category || '其他支出', 'expense')
            });
          });
          let store = wx.getStorageSync('fw_recurring_skip');
          if (store && typeof store === 'object') {
            const arr = Array.isArray(store[monthKey]) ? store[monthKey] : [];
            if (arr.length > 0) {
              recurringSynthExpense = (recurringSynthExpense || []).filter(x => !arr.includes(String(x.id)));
            }
          }
        } catch (e) {}
      } catch (e) {}
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
        try {
          const y = endDate.getFullYear();
          const m = endDate.getMonth() + 1;
          const monthKey = `${y}${String(m).padStart(2, '0')}`;
          const store = wx.getStorageSync('fw_rent_skip');
          const arr = store && typeof store === 'object' ? (store[monthKey] || []) : [];
          if (arr.length > 0) {
            rents = (rents || []).filter(x => !arr.includes(String(x.id)));
          }
        } catch (e) {}
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
        
        const monthIndex = endDate.getFullYear() * 12 + (endDate.getMonth() + 1);
        assets.forEach((acc) => {
          if (rentedAssetIds.has(acc.id)) return;
          const mi = Number(acc.monthly_income || 0);
          if (!(mi > 0)) return;
          let started = true;
          let monthsElapsed = 0;
          if (acc.invest_start_date) {
            const s = new Date(String(acc.invest_start_date).replace(/-/g, '/'));
            const si = s.getFullYear() * 12 + (s.getMonth() + 1);
            monthsElapsed = monthIndex - si;
            if (monthsElapsed < 0) started = false;
          }
          if (!started) return;
          const term = Number(acc.investment_term_months || 0);
          if (term > 0 && monthsElapsed >= term) return;
          if (acc.invest_end_date) {
            const e = new Date(String(acc.invest_end_date).replace(/-/g, '/'));
            if (!isNaN(e.getTime())) {
              const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
              if (monthIndex > ei) return;
            }
          }
          const fmt = (ds) => {
            const dd = new Date(String(ds).replace(/-/g, '/'));
            if (isNaN(dd.getTime())) return '';
            const yy = dd.getFullYear();
            const mm = String(dd.getMonth() + 1).padStart(2, '0');
            const dd2 = String(dd.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd2}`;
          };
          const startDisp = acc.invest_start_date ? fmt(acc.invest_start_date) : '';
          const endDisp = (() => {
            if (acc.invest_end_date) return fmt(acc.invest_end_date);
            const sd = acc.invest_start_date;
            if (sd && term > 0) {
              const s = new Date(String(sd).replace(/-/g, '/'));
              if (!isNaN(s.getTime())) {
                const yy = s.getFullYear();
                const mm = s.getMonth();
                const dd0 = s.getDate();
                const endMonthIdx = mm + term - 1;
                const endDate = new Date(yy, endMonthIdx + 1, 0);
                const day = Math.min(dd0, endDate.getDate());
                const final = new Date(yy, endMonthIdx, day);
                const y2 = final.getFullYear();
                const m2 = String(final.getMonth() + 1).padStart(2, '0');
                const d2 = String(final.getDate()).padStart(2, '0');
                return `${y2}-${m2}-${d2}`;
              }
            }
            return '';
          })();
          assetIncomes.push({
            id: `asset-income:${acc.id}`,
            type: 'income',
            category: acc.category || '资产收益',
            amount: this.formatNumber(mi),
            date: end,
            planned: true,
            recurring_monthly: true,
            _synthetic: 'asset-income',
            account_id: acc.id,
            account_name: acc.name,
            name: acc.name ? acc.name : (acc.category || '资产'),
            note: acc.name ? acc.name : (acc.category || '资产'),
            icon: getCategoryIcon(acc.category || '资产收益', 'income'),
            end_date: endDisp,
            recurring_start_date: startDisp,
            recurring_end_date: endDisp
          });
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
          const fmt = (ds) => {
            const dd = new Date(String(ds).replace(/-/g, '/'));
            if (isNaN(dd.getTime())) return '';
            const yy = dd.getFullYear();
            const mm = String(dd.getMonth() + 1).padStart(2, '0');
            const dd2 = String(dd.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd2}`;
          };
          const startDisp = acc.loan_start_date ? fmt(acc.loan_start_date) : '';
          const endDisp = (() => {
            if (acc.loan_end_date) return fmt(acc.loan_end_date);
            const sd = acc.loan_start_date;
            const term = Number(acc.loan_term_months || 0);
            if (sd && term > 0) {
              const s = new Date(String(sd).replace(/-/g, '/'));
              if (!isNaN(s.getTime())) {
                const yy = s.getFullYear();
                const mm = s.getMonth();
                const dd0 = s.getDate();
                const endMonthIdx = mm + term - 1;
                const endDate = new Date(yy, endMonthIdx + 1, 0);
                const day = Math.min(dd0, endDate.getDate());
                const final = new Date(yy, endMonthIdx, day);
                const y2 = final.getFullYear();
                const m2 = String(final.getMonth() + 1).padStart(2, '0');
                const d2 = String(final.getDate()).padStart(2, '0');
                return `${y2}-${m2}-${d2}`;
              }
            }
            return '';
          })();
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
            name: acc.name ? acc.name : (acc.category || '负债'),
            icon: getCategoryIcon((acc.category || '负债') + '月供', 'expense'),
            end_date: endDisp,
            recurring_start_date: startDisp,
            recurring_end_date: endDisp
          });
        };
        liabilities.forEach((acc) => {
          const mp = Number(acc.monthly_payment || 0);
          const startStr = acc.loan_start_date;
          const term = Number(acc.loan_term_months || 0);
          const endStr = acc.loan_end_date;
          if (!mp) return;
          if (!startStr) {
            if (!rangeStart || !rangeEnd) return;
            const y = rangeStart.getFullYear();
            const m = rangeStart.getMonth() + 1;
            const d = clampDay(y, m, 1);
            // 若存在结束日期，且该月超过结束月份，则不推入
            if (endStr) {
              const e = new Date(String(endStr).replace(/-/g, '/'));
              if (!isNaN(e.getTime())) {
                const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
                const mi = y * 12 + m;
                if (mi > ei) return;
              }
            }
            pushPayment(acc, y, m, d);
            return;
          }
          const s = new Date(String(startStr).replace(/-/g, "/"));
          const dueDay = s.getDate();
          if (range === 'all') {
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
            if (candidate >= s) {
              if (endStr) {
                const e = new Date(String(endStr).replace(/-/g, '/'));
                if (!isNaN(e.getTime()) && candidate > e) return;
              }
              pushPayment(acc, candidate.getFullYear(), candidate.getMonth() + 1, candidate.getDate());
            }
          } else {
            if (!rangeStart || !rangeEnd) return;
            let y = rangeStart.getFullYear();
            let m = rangeStart.getMonth() + 1;
            const d = clampDay(y, m, dueDay);
            const cand = new Date(y, m - 1, d);
            if (cand < s || cand > rangeEnd) return;
            const monthIndex = y * 12 + m;
            const startIndex = s.getFullYear() * 12 + (s.getMonth() + 1);
            const monthsElapsed = monthIndex - startIndex;
            if (monthsElapsed < 0) return;
            if (term > 0 && monthsElapsed >= term) return;
            if (endStr) {
              const e = new Date(String(endStr).replace(/-/g, '/'));
              if (!isNaN(e.getTime())) {
                const ei = e.getFullYear() * 12 + (e.getMonth() + 1);
                if (monthIndex > ei) return;
              }
            }
            if (cand >= rangeStart && cand <= rangeEnd) {
              pushPayment(acc, y, m, d);
            }
          }
        });
      } catch (err) {}
      
      let designServiceIncome = [];
      try {
        const app = getApp();
        if (range === 'month' && app?.globalData?.token && !app.globalData.guest) {
          const isCurrentMonth = (y === new Date().getFullYear() && m === (new Date().getMonth() + 1));
          const monthStr = `${y}-${String(m).padStart(2, '0')}`;
          const cacheKey = `fw_design_service_stats_month:${monthStr}`;
          let cached = null;
          try { cached = wx.getStorageSync(cacheKey); } catch (e) { cached = null; }
          const fresh = cached && cached.data && cached.data.success && (Date.now() - (cached.ts || 0) < 5 * 60 * 1000);
          let total = 0;
          if (fresh) {
            total = Number(cached.data.data?.total_revenue || 0);
          } else {
            const stats = isCurrentMonth ? await api.getFinanceStats('month') : await api.getFinanceStats('month', monthStr);
            if (stats.success) {
              total = Number(stats.data.total_revenue || 0);
              try { wx.setStorageSync(cacheKey, { data: stats, ts: Date.now() }); } catch (e) {}
            }
          }
          if (total > 0) {
            designServiceIncome = [{
              id: `design-service-income:${monthStr}`,
              type: 'income',
              category: '设计服务',
              amount: this.formatNumber(total),
              date: end,
              planned: true,
              recurring_monthly: false,
              _synthetic: 'design-service',
              name: '设计服务',
              note: '设计服务收入',
              icon: getCategoryIcon('设计服务', 'income')
            }];
          }
        }
      } catch (err) {}
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

      const dedupeById = (arr) => {
        const m = new Map();
        for (const x of arr) {
          const k = String(x.id);
          if (!m.has(k)) m.set(k, x);
        }
        return Array.from(m.values());
      };
      const combinedAll = dedupeById([...rents, ...assetIncomes, ...debts, ...formatted, ...recurringSynth, ...recurringSynthExpense, ...designServiceIncome, ...expectedExpenseFallback])
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map(item => ({
          ...item,
          icon: item.icon || getCategoryIcon(item.category, item.type)
        }));
      let combined = (forceAll || this.skipFilterOnce) ? combinedAll : combinedAll.filter((x) => activeType === 'all' || x.type === activeType);
      if (activeType !== 'all' && combined.length === 0 && combinedAll.length > 0) {
        combined = combinedAll;
      }
      if (this._lastFetchId !== fetchId) return;
      this.setFilteredList(combined);
      this.skipFilterOnce = false;

      // 汇总数值仅在 fetchSummary 中计算，这里不覆盖以避免受过滤器影响

      
    } catch (e) {
      // 游客模式下不显示演示数据
      this.setFilteredList([]);
    }
  },
  handleTypeTab(e) {
    const val = String(e.currentTarget.dataset.value || "all");
    if (val === this.data.activeType) return;
    this.setData({ activeType: val }, () => this.fetchList(true));
  },
  applyExpenseFilter() {
    if (this.data.activeType === 'expense') {
      this.setData({ activeType: 'all' }, () => this.fetchList(true));
    } else {
      this.setData({ activeType: 'expense' }, () => this.fetchList(true));
    }
  },
  applyIncomeFilter() {
    if (this.data.activeType === 'income') {
      this.setData({ activeType: 'all' }, () => this.fetchList(true));
    } else {
      this.setData({ activeType: 'income' }, () => this.fetchList(true));
    }
  },
  openCashflowActions(e) {
    const rawId = String(e.currentTarget.dataset.id || "");
    if (!rawId) return;
    // 不弹出菜单，长按直接进入详情页
    this.viewCashflow({ currentTarget: { dataset: { id: rawId } } });
  },
  editCashflow(id) {
    wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
  },
  viewCashflow(e) {
    const rawId = String(e.currentTarget.dataset.id || "");
    if (!rawId) return;
    if (rawId.startsWith('group:')) {
      return;
    }
    if (rawId.startsWith('tenancy:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
        const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&tenant_name=${encodeURIComponent(String(item.tenant_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || ''))}&recurring_start_date=${encodeURIComponent(String(item.recurring_start_date || ''))}&recurring_end_date=${encodeURIComponent(String(item.recurring_end_date || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    if (rawId.startsWith('loan:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
      const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || item.synthetic_kind || ''))}&recurring_start_date=${encodeURIComponent(String(item.recurring_start_date || ''))}&recurring_end_date=${encodeURIComponent(String(item.recurring_end_date || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    
    if (rawId.startsWith('asset-income:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
        const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || item.synthetic_kind || ''))}&recurring_start_date=${encodeURIComponent(String(item.recurring_start_date || ''))}&recurring_end_date=${encodeURIComponent(String(item.recurring_end_date || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    if (rawId.startsWith('design-service:')) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (item) {
        const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&synthetic_kind=${encodeURIComponent(String(item._synthetic || item.synthetic_kind || ''))}`;
        wx.navigateTo({ url });
        return;
      }
      wx.navigateTo({ url: `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}` });
      return;
    }
    const nonNumeric = Number.isNaN(Number(rawId));
    if (nonNumeric) {
      const item = (this.data.cashflows || []).find((x) => String(x.id) === rawId);
      if (!item) return;
      const m = String(rawId).match(/^recurring:(\d+):/);
      const baseId = m ? m[1] : '';
      const url = `/pages/cashflow-detail/index?synthetic=1&id=${encodeURIComponent(rawId)}&type=${encodeURIComponent(item.type || '')}&category=${encodeURIComponent(item.category || '')}&amount_display=${encodeURIComponent(String(item.amount || '0.00'))}&date=${encodeURIComponent(item.date || '')}&planned=${item.planned ? '1' : '0'}&recurring=${item.recurring_monthly ? '1' : '0'}&name=${encodeURIComponent(item.name || '')}&account_id=${encodeURIComponent(String(item.account_id || ''))}&account_name=${encodeURIComponent(String(item.account_name || ''))}&tenant_name=${encodeURIComponent(String(item.tenant_name || ''))}&synthetic_kind=${encodeURIComponent(String(item._synthetic || item.synthetic_kind || ''))}&note=${encodeURIComponent(String(item.note || ''))}&recurring_start_date=${encodeURIComponent(String(item.recurring_start_date || ''))}&recurring_end_date=${encodeURIComponent(String(item.recurring_end_date || ''))}&base_id=${encodeURIComponent(baseId)}`;
      wx.navigateTo({ url });
      return;
    }
    
    const id = Number(rawId);
    if (!id) return;
    wx.navigateTo({ url: `/pages/cashflow-detail/index?id=${id}` });
  },
  editSyntheticRecurring(item) {
    const sid = String(item.id || '');
    const m = sid.match(/^recurring:(\d+):/);
    if (m && m[1]) {
      wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${m[1]}` });
      return;
    }
    const q = [
      `type=${encodeURIComponent(item.type || '')}`,
      `category=${encodeURIComponent(item.category || '')}`,
      `amount=${encodeURIComponent(String(item.amount || '').replace(/,/g, ''))}`,
      `date=${encodeURIComponent(item.date || '')}`,
      `note=${encodeURIComponent(item.name || '')}`,
      `account_name=${encodeURIComponent(item.account_name || '')}`,
      `tenant_name=${encodeURIComponent(item.tenant_name || '')}`,
      `planned=1`,
      `recurring=1`,
      `ref=list`,
      `sid=${encodeURIComponent(String(item.id || ''))}`,
      `recurring_start_date=${encodeURIComponent(String(item.recurring_start_date || ''))}`,
      `recurring_end_date=${encodeURIComponent(String(item.recurring_end_date || ''))}`,
    ].join('&');
    wx.navigateTo({ url: `/pages/cashflow/index?${q}` });
  },
  deleteSyntheticRecurring(item) {
    const sid = String(item.id || '');
    if (!sid) return;
    wx.showModal({
      title: "删除确认",
      content: "本月不显示该重复项，确认吗？",
      success: (res) => {
        if (!res.confirm) return;
        let store = {};
        try { store = wx.getStorageSync('fw_recurring_skip'); } catch (e) { store = {}; }
        if (!store || typeof store !== 'object') store = {};
        const m = sid.match(/:(\d{6})$/);
        const monthKey = m ? m[1] : '';
        const arr = Array.isArray(store[monthKey]) ? store[monthKey] : [];
        if (!arr.includes(sid)) arr.push(sid);
        store[monthKey] = arr;
        try { wx.setStorageSync('fw_recurring_skip', store); } catch (e) {}
        wx.showToast({ title: "已隐藏", icon: "success" });
        this.fetchList(true, true);
      }
    });
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
    const planned = this.data.activePage === 'budget' ? 1 : 0;
    wx.navigateTo({ url: `/pages/cashflow/index?planned=${planned}` });
  }
});
