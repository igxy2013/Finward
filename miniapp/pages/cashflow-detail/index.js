const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    error: "",
    item: null,
    display: {
      title: "",
      amount: "0.00",
      typeLabel: "",
      statusLabel: "",
      date: "",
      category: "",
      recurringLabel: "",
      accountName: "",
      note: "",
      tenantName: "",
      icon: ""
    }
  },
  onLoad(options) {
    const synthetic = String(options?.synthetic || '') === '1';
    if (synthetic) {
      this.loadSynthetic(options);
      return;
    }
    const id = Number(options?.id || 0);
    if (!id) {
      this.setData({ loading: false, error: "参数错误" });
      return;
    }
    this.loadItem(id);
  },
  onShow() {
    if (this.data.synthetic) return;
    const id = Number(this.data?.item?.id || 0);
    if (!id) return;
    this.loadItem(id);
  },
  async loadSynthetic(options) {
    try {
      const d = (s) => {
        try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); }
      };
      const type = d(options.type || '');
      const statusLabel = options.planned === '1' ? '预计' : '实际';
      const typeLabel = type === 'income' ? '收入' : '支出';
      const recurringLabel = options.recurring === '1' ? '每月重复' : '';
      const amountText = d(options.amount_display || '0.00');
      const title = d(options.name || options.category || '记录');
      const icon = this.getIcon({ type });
      const recurringStartDate = d(options.recurring_start_date || options.date || '');
      const recurringEndDate = d(options.recurring_end_date || '');
      const baseId = d(options.base_id || '');
      this.setData({
        item: {
          id: d(options.id || ''),
          type,
          category: d(options.category || ''),
          amount: amountText,
          date: d(options.date || ''),
          planned: options.planned === '1',
          recurring_monthly: options.recurring === '1',
          recurring_start_date: recurringStartDate,
          recurring_end_date: recurringEndDate,
          name: d(options.name || ''),
          account_id: d(options.account_id || ''),
          account_name: d(options.account_name || ''),
          tenant_name: d(options.tenant_name || ''),
          _synthetic: d(options.synthetic_kind || ''),
          base_id: baseId
        },
        display: {
          title,
          amount: amountText,
          typeLabel,
          statusLabel,
          date: d(options.date || ''),
          category: d(options.category || ''),
          recurringLabel,
          recurringStartDate,
          recurringEndDate,
          accountName: d(options.account_name || ''),
          note: d(options.note || ''),
          tenantName: d(options.tenant_name || ''),
          icon
        },
        loading: false,
        synthetic: true
      });
      this.updateResolvedDates();
      const syn = String(this.data.item?._synthetic || '');
      const aid = Number(this.data.item?.account_id || 0);
      if (syn === 'rent') {
        const rs = String(this.data.item?.recurring_start_date || this.data.display?.recurringStartDate || '').trim();
        const reRaw = String(this.data.item?.recurring_end_date || this.data.display?.recurringEndDate || '').trim();
        const re = reRaw ? reRaw : '至今';
        if (rs || re) {
          this.setData({ display: { ...this.data.display, tenancyStartDate: rs, tenancyEndDate: re, endDate: re } });
          this.updateResolvedDates();
        }
        try {
          const m = String(this.data.item?.id || '').match(/^tenancy:(\d+)/);
          const tid = m ? Number(m[1]) : 0;
          if (tid) {
            this.setData({ item: { ...this.data.item, tenancy_id: tid } });
          }
          if (aid) {
            const tenants = await api.listTenants(aid);
            const t = (tenants || []).find(x => Number(x.id || 0) === tid) || null;
            if (t) {
              const s = t.start_date ? this.formatDateStr(t.start_date) : '';
              const e = t.end_date ? this.formatDateStr(t.end_date) : '至今';
              this.setData({ display: { ...this.data.display, tenancyStartDate: s, tenancyEndDate: e, endDate: e } });
              this.updateResolvedDates();
            }
          }
        } catch (eTen) {}
      }
      if (aid && (syn === 'loan-payment' || syn === 'loan' || syn === 'asset-income')) {
        try {
          const acc = await api.getAccount(aid);
          let endStr = '';
          if (syn === 'loan-payment' || syn === 'loan') {
            const ed = acc.loan_end_date;
            if (ed) endStr = this.formatDateStr(ed);
            else {
              const sd = acc.loan_start_date;
              const term = Number(acc.loan_term_months || 0);
              if (sd && term > 0) endStr = this.calcEndDate(sd, term);
            }
          } else if (syn === 'asset-income') {
            try {
              const tenants = await api.listTenants(aid);
              const dateStr = this.data.display?.date || '';
              const d = new Date(String(dateStr).replace(/-/g, '/'));
              const pickTenant = (arr) => {
                if (!Array.isArray(arr) || arr.length === 0) return null;
                const inRange = arr.find(t => {
                  const s = t.start_date ? new Date(String(t.start_date).replace(/-/g, '/')) : null;
                  const e = t.end_date ? new Date(String(t.end_date).replace(/-/g, '/')) : null;
                  if (s && d < s) return false;
                  if (e && d > e) return false;
                  return true;
                });
                return inRange || arr[0];
              };
              const t = pickTenant(tenants);
              if (t) {
                const s = t.start_date ? this.formatDateStr(t.start_date) : '';
                const e = t.end_date ? this.formatDateStr(t.end_date) : '至今';
                this.setData({ display: { ...this.data.display, tenancyStartDate: s, tenancyEndDate: e, endDate: e } });
                this.updateResolvedDates();
              } else {
                const ed = acc.invest_end_date;
                if (ed) endStr = this.formatDateStr(ed);
                else {
                  const sd = acc.invest_start_date;
                  const term = Number(acc.investment_term_months || 0);
                  if (sd && term > 0) endStr = this.calcEndDate(sd, term);
                }
              }
            } catch (eTen) {
              const ed = acc.invest_end_date;
              if (ed) endStr = this.formatDateStr(ed);
              else {
                const sd = acc.invest_start_date;
                const term = Number(acc.investment_term_months || 0);
                if (sd && term > 0) endStr = this.calcEndDate(sd, term);
              }
            }
          }
          if (endStr) {
            this.setData({ display: { ...this.data.display, endDate: endStr } });
            this.updateResolvedDates();
          }
        } catch (eAcc) {}
      }
      const bidNum = Number(baseId || 0);
      if (bidNum) {
        try {
          const baseItem = await api.getCashflow(bidNum);
          const rsd = baseItem.recurring_start_date || '';
          const red = baseItem.recurring_end_date || '';
          this.setData({
            item: { ...this.data.item, recurring_start_date: rsd || this.data.item.recurring_start_date, recurring_end_date: red || this.data.item.recurring_end_date },
            display: { ...this.data.display, recurringStartDate: rsd || this.data.display.recurringStartDate, recurringEndDate: red || this.data.display.recurringEndDate }
          });
        } catch (eFetch) {}
      }
    } catch (e) {
      this.setData({ loading: false, error: '加载失败' });
    }
  },
  formatDateStr(dateStr) {
    const d = new Date(String(dateStr).replace(/-/g, '/'));
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  calcEndDate(startStr, termMonths) {
    try {
      const s = new Date(String(startStr).replace(/-/g, '/'));
      if (isNaN(s.getTime())) return '';
      const y = s.getFullYear();
      const m = s.getMonth();
      const d = s.getDate();
      const endMonthIdx = m + Number(termMonths || 0) - 1;
      const endDate = new Date(y, endMonthIdx + 1, 0);
      const day = Math.min(d, endDate.getDate());
      const finalDate = new Date(y, endMonthIdx, day);
      const yy = finalDate.getFullYear();
      const mm = String(finalDate.getMonth() + 1).padStart(2, '0');
      const dd = String(finalDate.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    } catch (e) { return ''; }
  },
  async loadItem(id) {
    this.setData({ loading: true, error: "" });
    try {
      const item = await api.getCashflow(id);
      const typeLabel = item.type === "income" ? "收入" : "支出";
      const statusLabel = item.planned ? "预计" : "实际";
      const recurringLabel = (() => {
        if (item.recurring_monthly) return "每月重复";
        const s = String(item.note || "");
        if (/\[周期:每季度\]/.test(s)) return "每季度重复";
        if (/\[周期:每半年\]/.test(s)) return "每半年重复";
        if (/\[周期:每年\]/.test(s)) return "每年重复";
        return "";
      })();
      const amountText = this.formatNumber(item.amount);
      const title = item.name || item.category || "记录";
      const icon = this.getIcon(item);
      this.setData({
        item,
        display: {
          title,
          amount: amountText,
          typeLabel,
          statusLabel,
          date: item.date || "",
          category: item.category || "",
          recurringLabel,
          recurringStartDate: item.recurring_start_date || item.date || "",
          recurringEndDate: item.recurring_end_date || "",
          accountName: item.account_name || "",
          note: item.note || "",
          tenantName: item.tenant_name || "",
          icon
        },
        loading: false
      });
      this.updateResolvedDates();
      if (String(item.category || '') === '租金收入') {
        try {
          const aid = Number(item.account_id || 0);
          const tid = Number(item.tenancy_id || 0);
          if (aid) {
            const tenants = await api.listTenants(aid);
            let t = null;
            if (tid) {
              t = (tenants || []).find(x => Number(x.id || 0) === tid) || null;
            }
            if (!t && item.tenant_name) {
              t = (tenants || []).find(x => String(x.tenant_name || '') === String(item.tenant_name || '')) || null;
            }
            if (!t && Array.isArray(tenants) && tenants.length === 1) {
              t = tenants[0];
            }
            if (t) {
              const s = t.start_date ? this.formatDateStr(t.start_date) : '';
              const e = t.end_date ? this.formatDateStr(t.end_date) : '至今';
              this.setData({ display: { ...this.data.display, tenancyStartDate: s, tenancyEndDate: e, endDate: e } });
              this.updateResolvedDates();
            }
          }
        } catch (eRent) {}
      }
    } catch (e) {
      this.setData({ loading: false, error: "加载失败" });
    }
  },
  updateResolvedDates() {
    const disp = this.data.display || {};
    const it = this.data.item || {};
    let s = '';
    let e = '';
    if (disp.tenancyStartDate) s = disp.tenancyStartDate;
    else if (it.recurring_monthly && disp.recurringStartDate) s = disp.recurringStartDate;
    if (disp.tenancyEndDate) e = disp.tenancyEndDate;
    else if (disp.endDate) e = disp.endDate;
    else if (it.recurring_monthly && disp.recurringEndDate) e = disp.recurringEndDate;
    this.setData({ display: { ...disp, resolvedStartDate: s, resolvedEndDate: e } });
  },
  formatNumber(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return "0.00";
    return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  getIcon(item) {
    const t = item.type === "income" ? "arrow-up-s-line.svg" : "arrow-down-s-line-red.svg";
    return `/assets/icons/${t}`;
  },
  async edit() {
    const isSynthetic = !!this.data.synthetic;
    const it = this.data.item || {};
    if (String(it.category || '') === '租金收入') {
      const aid = Number(it.account_id || 0);
      const tid = Number(it.tenancy_id || 0);
      if (aid) {
        const tidParam = tid ? `&tenancy_id=${tid}` : '';
        wx.navigateTo({ url: `/pages/rent-detail/index?id=${aid}&edit=1${tidParam}` });
        return;
      }
    }
    if (isSynthetic && (it._synthetic === 'recurring-expense' || it._synthetic === 'recurring-income')) {
      const base = String(it.base_id || '').trim();
      let parsedBase = base;
      if (!parsedBase) {
        const m = String(it.id || '').match(/^recurring:(\d+):/);
        if (m && m[1]) parsedBase = m[1];
      }
      if (parsedBase) {
        wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${parsedBase}` });
        return;
      }
      const startDate = it.recurring_start_date || '';
      const endDate = it.recurring_end_date || '';
      const q = [
        `type=${encodeURIComponent(it.type || '')}`,
        `category=${encodeURIComponent(it.category || '')}`,
        `amount=${encodeURIComponent(String(it.amount || '').replace(/,/g, ''))}`,
        `date=${encodeURIComponent(it.date || '')}`,
        `note=${encodeURIComponent(it.name || '')}`,
        `account_name=${encodeURIComponent(it.account_name || '')}`,
        `tenant_name=${encodeURIComponent(it.tenant_name || '')}`,
        `planned=1`,
        `recurring=1`,
        `ref=detail`,
        `sid=${encodeURIComponent(String(it.id || ''))}`,
        `recurring_start_date=${encodeURIComponent(String(startDate || ''))}`,
        `recurring_end_date=${encodeURIComponent(String(endDate || ''))}`
      ].join('&');
      wx.navigateTo({ url: `/pages/cashflow/index?${q}` });
      return;
    }
    if (isSynthetic && (it._synthetic === 'loan-payment' || it._synthetic === 'loan')) {
      const aid = Number(it.account_id || 0);
      if (aid) {
        wx.navigateTo({ url: `/pages/liability-detail/index?id=${aid}` });
        return;
      }
    }
    if (isSynthetic && it._synthetic === 'asset-income') {
      const aid = Number(it.account_id || 0);
      if (aid) {
        try {
          const tenants = await api.listTenants(aid);
          if (Array.isArray(tenants) && tenants.length > 0) {
            const first = tenants[0] || null;
            const tidParam = first && first.id ? `&tenancy_id=${first.id}` : '';
            wx.navigateTo({ url: `/pages/rent-detail/index?id=${aid}&edit=1${tidParam}` });
            return;
          }
        } catch (e) {}
        wx.navigateTo({ url: `/pages/asset-detail/index?id=${aid}` });
        return;
      }
    }
    const id = Number(it.id || 0);
    if (!id) return;
    wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
  },
  async remove() {
    const isSynthetic = !!this.data.synthetic;
    const it = this.data.item || {};
    if (isSynthetic && (it._synthetic === 'recurring-expense' || it._synthetic === 'recurring-income')) {
      const base = String(it.base_id || '').trim();
      let parsedBase = base;
      if (!parsedBase) {
        const m = String(it.id || '').match(/^recurring:(\d+):/);
        if (m && m[1]) parsedBase = m[1];
      }
      if (parsedBase) {
        wx.showActionSheet({
          itemList: ["删除主记录", "仅隐藏本月"],
          success: async (res) => {
            if (res.tapIndex === 0) {
              try {
                await api.deleteCashflow(Number(parsedBase));
                wx.showToast({ title: "已删除", icon: "success" });
                wx.navigateBack();
              } catch (e) {
                wx.showToast({ title: "删除失败", icon: "none" });
              }
            } else if (res.tapIndex === 1) {
              const sid = String(it.id || '');
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
              wx.navigateBack();
            }
          }
        });
        return;
      }
      const sid = String(it.id || '');
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
          wx.navigateBack();
        }
      });
      return;
    }
    if (isSynthetic && (it._synthetic === 'loan-payment' || it._synthetic === 'loan' || it._synthetic === 'asset-income' || it._synthetic === 'rent')) {
      const sid = String(it.id || '');
      wx.showModal({
        title: "删除确认",
        content: "本月不显示该重复项，确认吗？",
        success: (res) => {
          if (!res.confirm) return;
          if (it._synthetic === 'rent') {
            let store = {};
            try { store = wx.getStorageSync('fw_rent_skip'); } catch (e) { store = {}; }
            if (!store || typeof store !== 'object') store = {};
            const monthKey = String(it.date || '').slice(0,7).replace('-', '');
            const arr = Array.isArray(store[monthKey]) ? store[monthKey] : [];
            if (!arr.includes(sid)) arr.push(sid);
            store[monthKey] = arr;
            try { wx.setStorageSync('fw_rent_skip', store); } catch (e) {}
          } else {
            let store = {};
            try { store = wx.getStorageSync('fw_recurring_skip'); } catch (e) { store = {}; }
            if (!store || typeof store !== 'object') store = {};
            const m = sid.match(/:(\d{6})$/);
            const monthKey = m ? m[1] : '';
            const arr = Array.isArray(store[monthKey]) ? store[monthKey] : [];
            if (!arr.includes(sid)) arr.push(sid);
            store[monthKey] = arr;
            try { wx.setStorageSync('fw_recurring_skip', store); } catch (e) {}
          }
          wx.showToast({ title: "已隐藏", icon: "success" });
          wx.navigateBack();
        }
      });
      return;
    }
    const id = Number(it.id || 0);
    if (!id) return;
    wx.showModal({
      title: "删除确认",
      content: "确定删除该记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteCashflow(id);
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (e) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  }
});
