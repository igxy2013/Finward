const api = require("../../utils/api");

Page({
  data: {
    assetOptions: [],
    assetIndex: 0,
    assetLabel: "请选择资产",
    dueDays: Array.from({ length: 31 }, (_, i) => i + 1),
    dueDayIndex: 0,
    frequencyOptions: [
      { label: "每月", value: "monthly" },
      { label: "每季度", value: "quarterly" },
      { label: "每半年", value: "semiannual" },
      { label: "每年", value: "annual" }
    ],
    frequencyIndex: 0,
    frequencyLabel: "每月",
    form: {
      account_id: 0,
      tenant_name: "",
      monthly_rent: "",
      frequency: "monthly",
      due_day: 1,
      start_date: "",
      end_date: "",
      contract_number: "",
      contract_url: "",
      reminder_enabled: true,
      note: ""
    },
    tenants: [],
    submitting: false
  },
  onLoad(options) {
    const accountId = options?.account_id ? Number(options.account_id) : 0;
    const tenancyId = options?.tenancy_id ? Number(options.tenancy_id) : 0;
    this.setData({ _incomingAccountId: accountId, _incomingTenancyId: tenancyId });
  },
  onShow() {
    this.loadAssets();
  },
  async loadAssets() {
    try {
      const assets = await api.listAccounts("asset");
      const options = (assets || []).map((a) => ({ label: a.name, value: a.id }));
      this.setData({ assetOptions: options });
      if (options.length > 0) {
        let idx = 0;
        if (this.data._incomingAccountId) {
          const found = options.findIndex((o) => Number(o.value) === Number(this.data._incomingAccountId));
          idx = found >= 0 ? found : 0;
        }
        const chosen = options[idx];
        this.setData({ assetIndex: idx, assetLabel: chosen.label, form: { ...this.data.form, account_id: chosen.value } });
        await this.refreshTenants(chosen.value);
        if (this.data._incomingTenancyId) {
          const t = (this.data.tenants || []).find((x) => Number(x.id) === Number(this.data._incomingTenancyId));
          if (t) {
            this.editTenant({ currentTarget: { dataset: { id: t.id } } });
          }
        }
      }
    } catch (e) {}
  },
  async refreshTenants(accountId) {
    try {
      const list = await api.listTenants(accountId);
      this.setData({ tenants: list });
    } catch (e) {}
  },
  handleAssetChange(e) {
    const idx = Number(e.detail.value || 0);
    const opt = this.data.assetOptions[idx];
    this.setData({ assetIndex: idx, assetLabel: opt.label, form: { ...this.data.form, account_id: opt.value } });
    this.refreshTenants(opt.value);
  },
  handleDueDayChange(e) {
    const idx = Number(e.detail.value || 0);
    const day = this.data.dueDays[idx];
    this.setData({ dueDayIndex: idx, form: { ...this.data.form, due_day: day } });
  },
  handleFrequencyChange(e) {
    const idx = Number(e.detail.value || 0);
    const opt = this.data.frequencyOptions[idx] || this.data.frequencyOptions[0];
    this.setData({ frequencyIndex: idx, frequencyLabel: opt.label, form: { ...this.data.form, frequency: opt.value } });
  },
  handleInput(e) {
    const key = String(e.currentTarget.dataset.key || "");
    const val = e.detail.value;
    const form = { ...this.data.form };
    form[key] = val;
    this.setData({ form });
  },
  handleStartDate(e) {
    const val = String(e.detail.value || "");
    this.setData({ form: { ...this.data.form, start_date: val } });
  },
  handleEndDate(e) {
    const val = String(e.detail.value || "");
    this.setData({ form: { ...this.data.form, end_date: val } });
  },
  async submit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.account_id || !f.tenant_name || !f.monthly_rent || !f.start_date) {
      wx.showToast({ title: "请填写必填项", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      await api.createTenant({
        account_id: f.account_id,
        tenant_name: f.tenant_name,
        monthly_rent: Number(f.monthly_rent),
        frequency: f.frequency || (this.data.frequencyOptions[this.data.frequencyIndex]?.value || "monthly"),
        due_day: Number(f.due_day || 1),
        start_date: f.start_date,
        end_date: f.end_date || null,
        contract_number: f.contract_number || null,
        contract_url: f.contract_url || null,
        reminder_enabled: !!f.reminder_enabled,
        note: f.note || null
      });
      wx.showToast({ title: "已保存", icon: "success" });
      this.refreshTenants(f.account_id);
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
  editTenant(e) {
    const id = Number(e.currentTarget.dataset.id);
    const t = this.data.tenants.find((x) => Number(x.id) === id);
    if (!t) return;
    const idx = this.data.assetOptions.findIndex((o) => Number(o.value) === Number(t.account_id));
    this.setData({
      assetIndex: idx >= 0 ? idx : 0,
      assetLabel: idx >= 0 ? this.data.assetOptions[idx].label : this.data.assetLabel,
      form: {
        account_id: t.account_id,
        tenant_name: t.tenant_name,
        monthly_rent: String(t.monthly_rent),
        due_day: t.due_day,
        start_date: t.start_date,
        end_date: t.end_date || "",
        contract_number: t.contract_number || "",
        contract_url: t.contract_url || "",
        reminder_enabled: !!t.reminder_enabled,
        note: t.note || ""
      }
    });
  },
  async removeTenant(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.showModal({
      title: "删除确认",
      content: "确定删除该租客记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteTenant(id);
          wx.showToast({ title: "已删除", icon: "success" });
          this.refreshTenants(this.data.form.account_id);
        } catch (e) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  },
  handleReminderToggle(e) {
    const checked = !!e.detail.value;
    this.setData({ form: { ...this.data.form, reminder_enabled: checked } });
  }
});
