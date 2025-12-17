const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    error: "",
    id: null,
    detail: {},
    tenants: [],
    rentRecords: [],
    showRentEditor: false,
    editorTenant: null
  },
  openAddTenant() {
    this.setData({ showRentEditor: true, editorTenant: null });
  },
  onLoad(options) {
    const id = Number(options?.id);
    if (!id) {
      this.setData({ loading: false, error: "参数错误" });
      return;
    }
    const autoOpen = String(options?.edit || '') === '1';
    const autoTid = Number(options?.tenancy_id || 0) || null;
    this.setData({ id, loading: true, error: "", _autoOpenEditor: autoOpen, _autoTenancyId: autoTid });
    this.init(id);
  },
  onShow() {
    const id = Number(this.data.id || 0);
    if (!id) return;
    this.init(id);
  },
  async init(id) {
    try {
      const detail = await api.getAccount(id);
      this.setData({ detail });
    } catch (e) {}
    await this.loadTenants(id);
    await this.fetchRentRecords();
    if (this.data._autoOpenEditor) {
      this.autoOpenRentEditor();
    }
  },
  async loadTenants(id) {
    try {
      const tenants = await api.listTenants(id);
      const formatted = (tenants || []).map(t => {
        const initialNext = t.next_due_date ? this.formatDate(t.next_due_date) : "";
        let nextDisplay = initialNext;
        if (nextDisplay && t.end_date) {
          const nd = new Date(`${nextDisplay}T00:00:00`);
          const ed = new Date(String(t.end_date).replace(' ', 'T'));
          if (nd > ed) nextDisplay = "";
        }
        if (t.end_date) {
          const today = new Date(`${this.today()}T00:00:00`);
          const ed = new Date(String(t.end_date).replace(' ', 'T'));
          if (ed < today) nextDisplay = "";
        }
        return {
          ...t,
          monthly_rent_display: this.formatNumber(t.monthly_rent),
          next_due_date_display: nextDisplay,
          frequency_label: this.mapFrequency(t.frequency || 'monthly'),
          due_day_display: t.due_day ? `每期${String(t.due_day)}日` : "",
          start_date_display: t.start_date ? this.formatDate(t.start_date) : "",
          end_date_display: t.end_date ? this.formatDate(t.end_date) : "",
          reminder_display: t.reminder_enabled ? "已开启" : "已关闭"
        };
      });
      this.setData({ tenants: formatted, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },
  autoOpenRentEditor() {
    const tenants = this.data.tenants || [];
    const tid = Number(this.data._autoTenancyId || 0);
    if (tenants.length === 0) {
      this.setData({ showRentEditor: true, editorTenant: null });
      return;
    }
    if (tid) {
      const match = tenants.find(t => Number(t.id || 0) === tid);
      if (match) {
        this.setData({ showRentEditor: true, editorTenant: match });
        return;
      }
    }
    if (tenants.length === 1) {
      this.setData({ showRentEditor: true, editorTenant: tenants[0] });
      return;
    }
    this.setData({ showRentEditor: true, editorTenant: tenants[0] });
  },
  openRentEditor() {
    const { tenants = [] } = this.data;
    if (!tenants.length) {
      this.setData({ showRentEditor: true, editorTenant: null });
      return;
    }
    if (tenants.length === 1) {
      this.setData({ showRentEditor: true, editorTenant: tenants[0] });
      return;
    }
    wx.showActionSheet({
      itemList: [...tenants.map(t => `编辑：${t.tenant_name || '未命名'}`), '新增租客'],
      success: (res) => {
        const idx = res.tapIndex;
        if (idx >= 0 && idx < tenants.length) {
          this.setData({ showRentEditor: true, editorTenant: tenants[idx] });
        } else if (idx === tenants.length) {
          this.setData({ showRentEditor: true, editorTenant: null });
        }
      }
    });
  },
  closeRentEditor() {
    this.setData({ showRentEditor: false, editorTenant: null });
  },
  async onRentEditorSaved() {
    const id = Number(this.data.id || 0);
    if (!id) return;
    await this.loadTenants(id);
    await this.fetchRentRecords();
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
        const next0 = addMonths(last, freqMonths(t.frequency || 'monthly'));
        let next = next0;
        if (next && t.end_date) {
          const nd = new Date(`${next}T00:00:00`);
          const ed = new Date(String(t.end_date).replace(' ', 'T'));
          if (nd > ed) next = "";
        }
        if (t.end_date) {
          const today = new Date(`${this.today()}T00:00:00`);
          const ed = new Date(String(t.end_date).replace(' ', 'T'));
          if (ed < today) next = "";
        }
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
  editTenant(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    const tenant = this.data.tenants.find(t => Number(t.id) === id);
    if (tenant) {
      this.setData({ showRentEditor: true, editorTenant: tenant });
    }
  },
  async deleteTenant(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条出租记录吗？',
      success: async function (res) {
        if (res.confirm) {
          try {
            await api.deleteTenant(id);
            wx.showToast({ title: "已删除", icon: "success" });
            const accountId = Number(that.data.id || 0);
            if (accountId) {
              await that.loadTenants(accountId);
            }
          } catch (err) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  },
  mapFrequency(f) {
    const m = { monthly: "按月", quarterly: "按季", semiannual: "半年", annual: "按年" };
    return m[f] || "按月";
  },
  formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
