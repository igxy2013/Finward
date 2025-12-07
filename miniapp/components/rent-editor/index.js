const api = require("../../utils/api");

Component({
  properties: {
    visible: { type: Boolean, value: false },
    accountId: { type: Number, value: null },
    tenant: { type: Object, value: null }
  },
  data: {
    form: {
      tenant_name: "",
      monthly_rent: "",
      frequency: "monthly",
      due_day: 0,
      start_date: "",
      end_date: "",
      contract_number: "",
      contract_url: "",
      reminder_enabled: true,
      note: ""
    },
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
    saving: false
    ,displayTitle: "编辑出租信息"
  },
  observers: {
    tenant(t) {
      if (!t) {
        this.setData({ displayTitle: "添加出租信息" });
        return;
      }
      const idx = Math.max(0, this.data.dueDays.findIndex((d) => Number(d) === Number(t.due_day)));
      const fIdx = Math.max(0, this.data.frequencyOptions.findIndex(o => (o.value || o) === (t.frequency || 'monthly')));
      this.setData({
        dueDayIndex: idx,
        frequencyIndex: fIdx,
        frequencyLabel: (this.data.frequencyOptions[fIdx] || this.data.frequencyOptions[0]).label,
        form: {
          tenant_name: t.tenant_name || "",
          monthly_rent: String(t.monthly_rent || ""),
          frequency: t.frequency || "monthly",
          due_day: Number(t.due_day || 0),
          start_date: t.start_date || "",
          end_date: t.end_date || "",
          contract_number: t.contract_number || "",
          contract_url: t.contract_url || "",
          reminder_enabled: !!t.reminder_enabled,
          note: t.note || ""
        },
        displayTitle: (t && t.id) ? "编辑出租信息" : "添加出租信息"
      });
    }
  },
  methods: {
    close() {
      this.triggerEvent('close');
    },
    
    handleInput(e) {
      const key = e.currentTarget.dataset.key;
      const v = e.detail.value;
      this.setData({ [`form.${key}`]: v });
    },
    handleFrequencyChange(e) {
      const idx = Number(e.detail.value || 0);
      const opt = this.data.frequencyOptions[idx] || this.data.frequencyOptions[0];
      this.setData({ frequencyIndex: idx, frequencyLabel: opt.label, "form.frequency": opt.value });
    },
    handleDueDayChange(e) {
      const idx = Number(e.detail.value || 0);
      const day = this.data.dueDays[idx];
      this.setData({ dueDayIndex: idx, "form.due_day": Number(day) });
    },
    handleStartDate(e) { this.setData({ "form.start_date": e.detail.value }); },
    handleEndDate(e) { this.setData({ "form.end_date": e.detail.value }); },
    handleReminderToggle(e) { this.setData({ "form.reminder_enabled": !!e.detail.value }); },
    async save() {
      if (this.data.saving) return;
      const accountId = Number(this.data.accountId || 0);
      if (!accountId) { wx.showToast({ title: "缺少关联资产", icon: "none" }); return; }
      const f = this.data.form;
      const payload = {
        account_id: accountId,
        tenant_name: f.tenant_name || "",
        monthly_rent: f.monthly_rent !== "" ? Number(f.monthly_rent) : 0,
        frequency: f.frequency || "monthly",
        due_day: Number(f.due_day || 0),
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        contract_number: f.contract_number || null,
        contract_url: f.contract_url || null,
        reminder_enabled: !!f.reminder_enabled,
        note: f.note || null
      };
      this.setData({ saving: true });
      try {
        const t = this.properties.tenant;
        if (t && t.id) {
          await api.updateTenant(t.id, payload);
        } else {
          await api.createTenant(payload);
        }
        wx.showToast({ title: "已保存", icon: "success" });
        this.triggerEvent('saved');
        this.close();
      } catch (e) {
        wx.showToast({ title: "保存失败", icon: "none" });
      } finally {
        this.setData({ saving: false });
      }
    }
  }
});
