const api = require("../../utils/api");

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

Page({
  data: {
    loading: true,
    error: "",
    id: null,
    detail: {},
    icon: "wallet-3-line.svg",
    tenants: [],
    rentRecords: [],
    change_positive: false,
    change_negative: false,
    change_sign: ""
  },
  collectRent() {
    const { tenants = [], detail = {} } = this.data;
    if (!tenants.length) {
      wx.showToast({ title: "无租客信息", icon: "none" });
      return;
    }
    const go = (t) => {
      const amt = Number(t?.monthly_rent || 0);
      const date = this.today();
      const note = `${detail.name || ''} - ${t?.tenant_name || ''}`.trim();
      const url = `/pages/cashflow/index?preset=rent&type=income&category=${encodeURIComponent('租金收入')}&amount=${encodeURIComponent(String(amt))}&date=${encodeURIComponent(date)}&note=${encodeURIComponent(note)}&account_id=${encodeURIComponent(String(detail.id || ''))}&tenancy_id=${encodeURIComponent(String(t?.id || ''))}&account_name=${encodeURIComponent(String(detail.name || ''))}&tenant_name=${encodeURIComponent(String(t?.tenant_name || ''))}`;
      wx.navigateTo({ url });
    };
    if (tenants.length === 1) {
      go(tenants[0]);
      return;
    }
    wx.showActionSheet({
      itemList: tenants.map(x => `${x.tenant_name} ￥${this.formatNumber(x.monthly_rent)}`),
      success: (res) => {
        const idx = res.tapIndex;
        if (idx >= 0 && idx < tenants.length) go(tenants[idx]);
      }
    });
  },
  today() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  onLoad(options) {
    const id = Number(options?.id);
    if (!id) {
      this.setData({ loading: false, error: "参数错误" });
      return;
    }
    this.setData({ id, loading: true, error: "" });
    this.fetchDetail(id);
  },
  onShow() {
    const id = Number(this.data.id || 0);
    if (!id) return;
    this.fetchDetail(id);
  },
  onShow() {
    const { id, detail } = this.data;
    if (!id) return;
    if (String(detail?.category) === "房产") {
      this.fetchRentRecords();
    }
  },
  openEditMenu() {
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: (res) => {
        if (res.tapIndex === 0) this.editAccount();
        if (res.tapIndex === 1) this.deleteAccount();
      }
    });
  },
  editAccount() {
    const id = Number(this.data.id || this.data.detail?.id || 0);
    if (!id) return;
    wx.navigateTo({ url: `/pages/manage/index?edit=1&id=${id}` });
  },
  async deleteAccount() {
    const id = Number(this.data.id || this.data.detail?.id || 0);
    if (!id) return;
    wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，是否确认删除该资产？",
      confirmText: "删除",
      cancelText: "取消",
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteAccount(id);
            wx.showToast({ title: "已删除", icon: "success" });
            setTimeout(() => wx.navigateBack(), 400);
          } catch (e) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  },
  async fetchDetail(id) {
    try {
      const data = await api.getAccount(id);
      const icon = this.getIcon(data.category);
      const current = this.parseNumber(data.current_value ?? data.amount);
      const initial = this.parseNumber(data.initial_amount ?? data.amount);
      const change = current - initial;
      const change_positive = change > 0;
      const change_negative = change < 0;
      const change_sign = change > 0 ? "+￥" : (change < 0 ? "-￥" : "￥");
      const detail = {
        ...data,
        current_value_display: this.formatNumber(current),
        initial_amount_display: this.formatNumber(initial),
        change_display: this.formatNumber(Math.abs(change)),
        updated_at_display: this.formatDate(data.updated_at),
        created_at_display: this.formatDate(data.created_at),
        next_due_date_display: data.next_due_date ? this.formatDate(data.next_due_date) : "",
        monthly_payment_display: data.monthly_payment ? this.formatNumber(data.monthly_payment) : "",
        monthly_income_display: data.monthly_income ? this.formatNumber(data.monthly_income) : "",
        loan_start_date_display: data.loan_start_date ? this.formatDate(data.loan_start_date) : "",
        loan_end_date_display: (() => {
          const ed = data.loan_end_date;
          if (ed) return this.formatDate(ed);
          const sd = data.loan_start_date;
          const term = Number(data.loan_term_months || 0);
          if (!sd || !(term > 0)) return "";
          const s = new Date(String(sd).replace(/-/g, "/"));
          if (isNaN(s.getTime())) return "";
          const y = s.getFullYear();
          const m = s.getMonth();
          const d = s.getDate();
          const endMonthIdx = m + term - 1;
          const endDate = new Date(y, endMonthIdx + 1, 0);
          const day = Math.min(d, endDate.getDate());
          const finalDate = new Date(y, endMonthIdx, day);
          return this.formatDate(`${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, '0')}-${String(finalDate.getDate()).padStart(2, '0')}`);
        })(),
        invest_start_date_display: data.invest_start_date ? this.formatDate(data.invest_start_date) : "",
        invest_end_date_display: (() => {
          const ed = data.invest_end_date;
          if (ed) return this.formatDate(ed);
          const sd = data.invest_start_date;
          const term = Number(data.investment_term_months || 0);
          if (!sd || !(term > 0)) return "";
          const s = new Date(String(sd).replace(/-/g, "/"));
          if (isNaN(s.getTime())) return "";
          const y = s.getFullYear();
          const m = s.getMonth();
          const d = s.getDate();
          const endMonthIdx = m + term - 1;
          const endDate = new Date(y, endMonthIdx + 1, 0);
          const day = Math.min(d, endDate.getDate());
          const finalDate = new Date(y, endMonthIdx, day);
          return this.formatDate(`${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, '0')}-${String(finalDate.getDate()).padStart(2, '0')}`);
        })(),
        depreciation_rate_display: (data.depreciation_rate != null && data.depreciation_rate !== "") ? Number(data.depreciation_rate * 100).toFixed(2) : ""
      };
      this.setData({
        detail,
        icon,
        change_positive,
        change_negative,
        change_sign,
        loading: false
      });
      if (String(data.category) === "房产") {
        try {
          const tenants = await api.listTenants(id);
          const formatted = (tenants || []).map(t => ({
            ...t,
            monthly_rent_display: this.formatNumber(t.monthly_rent),
            next_due_date_display: t.next_due_date ? this.formatDate(t.next_due_date) : "",
            frequency_label: this.mapFrequency(t.frequency || 'monthly'),
            due_day_display: t.due_day ? `每期${String(t.due_day)}日` : "",
            start_date_display: t.start_date ? this.formatDate(t.start_date) : "",
            end_date_display: t.end_date ? this.formatDate(t.end_date) : "",
            reminder_display: t.reminder_enabled ? "已开启" : "已关闭"
          }));
          this.setData({ tenants: formatted });
        } catch (e) {}
        await this.fetchRentRecords();
      }
    } catch (error) {
      this.setData({ loading: false, error: "加载失败" });
    }
  },
  mapFrequency(f) {
    const m = { monthly: "按月", quarterly: "按季", semiannual: "半年", annual: "按年" };
    return m[f] || "按月";
  },
  async fetchRentRecords() {
    try {
      const { detail, tenants = [] } = this.data;
      const list = await api.listCashflows({ type: 'income' });
      const assetName = String(detail?.name || "");
      const isIncome = (x) => String(x.type || '') === 'income';
      const isRentCategory = (x) => String(x.category || '') === '租金收入';
      const base = (list || []).filter(isIncome).filter(isRentCategory);
      const strictByFields = base.filter(x => (Number(x.account_id || 0) === Number(detail.id)) || (x.account_name && String(x.account_name) === assetName));
      let chosen = strictByFields;
      if (!chosen.length) {
        const aMarker = detail?.id ? `[asset:${detail.id}]` : '';
        const tMarkers = (tenants || []).map(t => t?.id ? `[tenant:${t.id}]` : '').filter(Boolean);
        const tNames = (tenants || []).map(t => String(t.tenant_name || '')).filter(Boolean);
        const noteOf = (x) => String(x.note || '');
        chosen = base.filter(x => {
          const note = noteOf(x);
          if (aMarker && note.includes(aMarker)) return true;
          if (assetName && note.includes(`${assetName} -`)) return true;
          if (tMarkers.length && tMarkers.some(m => note.includes(m))) return true;
          if (tNames.length && tNames.some(n => n && note.includes(n))) return true;
          return false;
        });
      }
      const records = chosen.map(x => ({
        id: x.id,
        amount_display: this.formatNumber(x.amount),
        date_display: this.formatDate(x.date),
        raw_date: x.date,
        note: x.note || '',
        account_id: x.account_id || null,
        tenancy_id: x.tenancy_id || null,
        account_name: x.account_name || ''
      }));
      this.setData({ rentRecords: records }, () => {
        this.recomputeNextDueForTenants();
      });
    } catch (e) {}
  },
  recomputeNextDueForTenants() {
    const { tenants = [], rentRecords = [] } = this.data;
    if (!tenants.length) return;
    const freqMonths = (f) => {
      if (f === 'quarterly') return 3;
      if (f === 'semiannual') return 6;
      if (f === 'annual') return 12;
      return 1;
    };
    const addMonths = (dateStr, months) => {
      try {
        const d = new Date(String(dateStr).replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = d.getMonth();
        const dd = d.getDate();
        const targetM = m + months;
        const y2 = y + Math.floor(targetM / 12);
        const m2 = ((targetM % 12) + 12) % 12;
        const daysInMonth = (ym) => {
          const [yy, mm] = ym;
          return new Date(yy, mm + 1, 0).getDate();
        };
        const maxDay = daysInMonth([y2, m2]);
        const d2 = Math.min(dd, maxDay);
        const res = new Date(y2, m2, d2);
        const yS = res.getFullYear();
        const mS = String(res.getMonth() + 1).padStart(2, '0');
        const dS = String(res.getDate()).padStart(2, '0');
        return `${yS}-${mS}-${dS}`;
      } catch (e) {
        return '';
      }
    };
    const updated = tenants.map(t => {
      const last = rentRecords
        .filter(r => Number(r.tenancy_id || 0) === Number(t.id))
        .map(r => r.raw_date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];
      if (last) {
        const next = addMonths(last, freqMonths(t.frequency || 'monthly'));
        return { ...t, next_due_date_display: next };
      }
      return t;
    });
    this.setData({ tenants: updated });
  },
  copyContractUrl(e) {
    const url = String(e.currentTarget.dataset.url || "");
    if (!url) { wx.showToast({ title: "无合同链接", icon: "none" }); return; }
    wx.setClipboardData({ data: url, success: () => wx.showToast({ title: "链接已复制", icon: "success" }) });
  },
  openRentRecordActions(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: async (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
        } else if (res.tapIndex === 1) {
          try {
            await api.deleteCashflow(id);
            wx.showToast({ title: "已删除", icon: "success" });
            this.fetchRentRecords();
          } catch (e) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  },
  editRentRecord(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
  },
  async deleteRentRecord(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    try {
      await api.deleteCashflow(id);
      wx.showToast({ title: "已删除", icon: "success" });
      this.fetchRentRecords();
    } catch (err) {
      wx.showToast({ title: "删除失败", icon: "none" });
    }
  },
  getIcon(category) {
    return ASSET_CATEGORY_ICONS[category] || "wallet-3-line.svg";
  },
  formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  parseNumber(val) {
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/,/g, "").trim();
      const num = Number(cleaned);
      return Number.isNaN(num) ? 0 : num;
    }
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
  },
  formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(String(dateStr).replace(' ', 'T'));
      if (isNaN(date.getTime())) return "";
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch (e) {
      return "";
    }
  }
});
