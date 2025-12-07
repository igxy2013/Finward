const api = require("../../utils/api");

const LIABILITY_CATEGORY_ICONS = {
  "信用卡": "bank-line-red.svg",
  "消费贷": "wallet-line-red.svg",
  "房贷": "home-4-line-red.svg",
  "车贷": "car-line-red.svg",
  "借款": "money-cny-circle-line-red.svg",
  "应付款": "bill-line-red.svg",
  "其他": "wallet-line-red.svg"
};

Page({
  data: {
    loading: true,
    error: "",
    id: null,
    detail: {},
    icon: "bill-line-red.svg",
    change_positive: false,
    change_negative: false,
    change_sign: "",
    showUpdateModal: false,
    updateValueInput: "",
    savingUpdate: false,
    valueUpdates: [],
    valueUpdatesRaw: [],
    editingUpdateId: null,
    editingUpdateTs: null
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
    this.loadValueUpdates();
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
          const yy = finalDate.getFullYear();
          const mm = String(finalDate.getMonth() + 1).padStart(2, '0');
          const dd = String(finalDate.getDate()).padStart(2, '0');
          return `${yy}-${mm}-${dd}`;
        })(),
        annual_interest_rate_display: (data.annual_interest_rate != null && data.annual_interest_rate !== "") ? Number(data.annual_interest_rate * 100).toFixed(2) : ""
      };
      this.setData({ detail, icon, change_positive, change_negative, change_sign, loading: false });
      this.loadValueUpdates();
    } catch (error) {
      this.setData({ loading: false, error: "加载失败" });
    }
  },
  loadValueUpdates() {
    const id = Number(this.data.id || 0);
    if (!id) return;
    (async () => {
      try {
        const arr = await api.listAccountValueUpdates(id);
        const formatted = (arr || []).map(r => ({
          id: r.id != null ? r.id : null,
          raw_ts: r.created_at || r.ts || null,
          value_raw: Number(r.value || 0),
          value_display: this.formatNumber(r.value),
          date_display: this.formatDateTime(r.created_at || new Date(r.ts))
        }));
        this.setData({ valueUpdates: formatted, valueUpdatesRaw: arr || [] });
      } catch (e) {
        let arr = [];
        try { arr = wx.getStorageSync(`fw_value_updates:${id}`) || []; } catch (err) { arr = []; }
        const formatted = (arr || []).map(r => ({
          id: null,
          raw_ts: r.ts,
          value_raw: Number(r.value || 0),
          value_display: this.formatNumber(r.value),
          date_display: this.formatDateTime(new Date(r.ts))
        }));
        this.setData({ valueUpdates: formatted, valueUpdatesRaw: arr || [] });
      }
    })();
  },
  editValueUpdate(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    const ts = String(e.currentTarget.dataset.ts || "");
    const rec = (this.data.valueUpdates || []).find(x => (id ? String(x.id) === String(id) : String(x.raw_ts || '') === ts));
    if (!rec) return;
    const dateTime = rec.raw_ts ? new Date(rec.raw_ts) : new Date();
    const y = dateTime.getFullYear();
    const m = String(dateTime.getMonth() + 1).padStart(2, '0');
    const d = String(dateTime.getDate()).padStart(2, '0');
    const hh = String(dateTime.getHours()).padStart(2, '0');
    const mm = String(dateTime.getMinutes()).padStart(2, '0');
    this.setData({ showUpdateModal: true, updateValueInput: String(rec.value_raw || ''), updateDateInput: `${y}-${m}-${d}`, updateTimeInput: `${hh}:${mm}`, savingUpdate: false, editingUpdateId: id || null, editingUpdateTs: ts || null });
  },
  async deleteValueUpdate(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    const ts = String(e.currentTarget.dataset.ts || "");
    const accountId = Number(this.data.id || 0);
    if (!accountId) return;
    wx.showModal({
      title: "删除确认",
      content: "确定删除该更新记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        let ok = false;
        if (id) {
          try { await api.deleteAccountValueUpdate(accountId, id); ok = true; } catch (e) { ok = false; }
        }
        if (!ok) {
          try {
            let arr = wx.getStorageSync(`fw_value_updates:${accountId}`) || [];
            arr = (arr || []).filter(r => String(r.ts) !== ts);
            wx.setStorageSync(`fw_value_updates:${accountId}`, arr);
            ok = true;
          } catch (e) { ok = false; }
        }
        if (ok) {
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadValueUpdates();
        } else {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  },
  openUpdateModal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    this.setData({ showUpdateModal: true, updateValueInput: "", updateDateInput: `${y}-${m}-${d}`, updateTimeInput: `${hh}:${mm}`, savingUpdate: false, editingUpdateId: null, editingUpdateTs: null });
  },
  closeUpdateModal() {
    this.setData({ showUpdateModal: false, savingUpdate: false });
  },
  handleUpdateInput(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateValueInput: v });
  },
  handleUpdateDateChange(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateDateInput: v });
  },
  handleUpdateTimeChange(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateTimeInput: v });
  },
  async saveUpdateValue() {
    if (this.data.savingUpdate) return;
    const id = Number(this.data.id || 0);
    const vstr = String(this.data.updateValueInput || "").replace(/,/g, "");
    const val = Number(vstr);
    if (!id || Number.isNaN(val)) { wx.showToast({ title: "请输入有效金额", icon: "none" }); return; }
    this.setData({ savingUpdate: true });
    try {
      await api.updateAccount(id, { current_value: val });
      const updId = this.data.editingUpdateId;
      const dateStr = String(this.data.updateDateInput || "");
      const timeStr = String(this.data.updateTimeInput || "");
      let ts = Date.now();
      if (dateStr && timeStr) {
        const dt = new Date(`${dateStr} ${timeStr}`.replace(' ', 'T'));
        if (!isNaN(dt.getTime())) ts = dt.getTime();
      }
      if (updId) {
        try { await api.updateAccountValueUpdate(id, updId, val, ts); } catch (e2) {}
      } else {
        try { await api.createAccountValueUpdate(id, val, ts); } catch (e2) {}
      }
      let arr = [];
      try { arr = wx.getStorageSync(`fw_value_updates:${id}`) || []; } catch (e) { arr = []; }
      if (updId) {
        arr = (arr || []).map(r => ({ ...r, value: String(r.ts) === String(this.data.editingUpdateTs || '') ? val : r.value, ts: String(r.ts) === String(this.data.editingUpdateTs || '') ? ts : r.ts }));
      } else {
        arr.unshift({ value: val, ts });
      }
      try { wx.setStorageSync(`fw_value_updates:${id}`, arr); } catch (e) {}
      this.closeUpdateModal();
      wx.showToast({ title: "已更新", icon: "success" });
      this.fetchDetail(id);
      this.loadValueUpdates();
    } catch (e) {
      this.setData({ savingUpdate: false });
      wx.showToast({ title: "更新失败", icon: "none" });
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
      content: "删除后不可恢复，是否确认删除该负债？",
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
  getIcon(category) {
    return LIABILITY_CATEGORY_ICONS[category] || "bill-line-red.svg";
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
  ,formatDateTime(input) {
    if (!input) return "";
    try {
      const date = (input instanceof Date) ? input : new Date(String(input).replace(' ', 'T'));
      if (isNaN(date.getTime())) return "";
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}`;
    } catch (e) { return ""; }
  }
});
