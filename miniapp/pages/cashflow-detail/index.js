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
  loadSynthetic(options) {
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
      const recurringStartDate = d(options.recurring_start_date || '');
      const recurringEndDate = d(options.recurring_end_date || '');
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
          _synthetic: d(options.synthetic_kind || '')
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
    } catch (e) {
      this.setData({ loading: false, error: '加载失败' });
    }
  },
  async loadItem(id) {
    this.setData({ loading: true, error: "" });
    try {
      const item = await api.getCashflow(id);
      const typeLabel = item.type === "income" ? "收入" : "支出";
      const statusLabel = item.planned ? "预计" : "实际";
      const recurringLabel = item.recurring_monthly ? "每月重复" : "";
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
          recurringStartDate: item.recurring_start_date || "",
          recurringEndDate: item.recurring_end_date || "",
          accountName: item.account_name || "",
          note: item.note || "",
          tenantName: item.tenant_name || "",
          icon
        },
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false, error: "加载失败" });
    }
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
  edit() {
    const isSynthetic = !!this.data.synthetic;
    const it = this.data.item || {};
    if (isSynthetic && it._synthetic === 'recurring-expense') {
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
    const id = Number(it.id || 0);
    if (!id) return;
    wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
  },
  async remove() {
    const isSynthetic = !!this.data.synthetic;
    const it = this.data.item || {};
    if (isSynthetic && (it._synthetic === 'recurring-expense' || it._synthetic === 'recurring-income')) {
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
