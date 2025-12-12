const api = require("../../utils/api");

Page({
  data: {
    activePage: "budget",
    form: {
      type: "expense",
      category: "",
      amount: "",
      planned: false,
      recurring_monthly: false,
      recurring_start_date: "",
      recurring_end_date: "",
      date: "",
      note: ""
    },
    hidden: {
      account_id: null,
      tenancy_id: null,
      account_name: ""
    },
    submitting: false,
    categoryIndex: -1,
    categoryDisplay: "请选择类别",
    incomeCategoryOptions: [
      { label: "租金收入" },
      { label: "工资" },
      { label: "奖金" },
      { label: "理财收益" },
      { label: "分红" },
      { label: "投资回款" },
      { label: "其他收入" }
    ],
    expenseCategoryOptions: [
      { label: "餐饮" },
      { label: "交通出行" },
      { label: "房租" },
      { label: "物业管理" },
      { label: "水电网" },
      { label: "通讯" },
      { label: "教育培训" },
      { label: "医疗健康" },
      { label: "保险" },
      { label: "娱乐休闲" },
      { label: "服饰美妆" },
      { label: "日用品" },
      { label: "借款还款" },
      { label: "其他支出" }
    ],
    categoryOptions: [],
    recurringOptions: ["不重复", "每月", "每季度", "每半年", "每年"],
    recurringIndex: 0
  },
  handlePageSwitch(e) {
    const val = String(e.currentTarget.dataset.value || "budget");
    if (val === this.data.activePage) return;
    const planned = (val === 'budget');
    this.setData({ activePage: val, "form.planned": planned });
  },
  handleHiddenInput(e) {
    const key = String(e.currentTarget.dataset.key || "");
    const val = e.detail.value;
    if (!key) return;
    this.setData({ [`hidden.${key}`]: val });
  },
  onLoad(options) {
    const edit = options?.edit;
    const id = options?.id ? Number(options.id) : null;
    const today = this.formatDate(new Date());
    this.setData({
      "form.date": today,
      "form.recurring_start_date": "",
      "form.recurring_end_date": "",
      activePage: "budget",
      categoryOptions: this.data.expenseCategoryOptions,
      categoryIndex: -1,
      categoryDisplay: "请选择类别"
    });
    if (edit && id) {
      this.setData({ editId: id });
      try { wx.setNavigationBarTitle({ title: '编辑收支' }); } catch (e) {}
      this.prefill(id);
    }
    if (options && options.preset === 'rent') {
      const type = String(options.type || 'income');
      const category = decodeURIComponent(String(options.category || '租金收入'));
      const amount = String(options.amount || '');
      const date = String(options.date || today);
      const note = decodeURIComponent(String(options.note || ''));
      const account_id = options.account_id ? Number(options.account_id) : null;
      const tenancy_id = options.tenancy_id ? Number(options.tenancy_id) : null;
      const account_name = options.account_name ? decodeURIComponent(String(options.account_name)) : "";
      const tenant_name = options.tenant_name ? decodeURIComponent(String(options.tenant_name)) : "";
      const categoryOptions = type === 'income' ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
      const catIndex = Math.max(0, categoryOptions.findIndex(opt => opt.label === category));
      this.setData({
        form: {
          type,
          category,
          amount,
          planned: false,
          recurring_monthly: false,
          date,
          note
        },
        hidden: { account_id, tenancy_id, account_name, tenant_name },
        categoryOptions,
        categoryIndex: catIndex,
        categoryDisplay: category
      });
    }
    // 通用预填：支持从详情页传入参数(type, category, amount, date, note, account_name, tenant_name)
    if (options && !edit && !this.data.editId && (options.type || options.category || options.amount || options.date || options.note || options.planned || options.recurring)) {
      const type = String(options.type || 'expense');
      const category = decodeURIComponent(String(options.category || ''));
      const amount = String(options.amount || '');
      const date = String(options.date || today);
      const note = decodeURIComponent(String(options.note || ''));
      const account_name = options.account_name ? decodeURIComponent(String(options.account_name)) : "";
      const tenant_name = options.tenant_name ? decodeURIComponent(String(options.tenant_name)) : "";
      const plannedOpt = String(options.planned || '');
      const recurringOpt = String(options.recurring || '');
      const planned = plannedOpt === '1' || plannedOpt === 'true';
      const recurring = recurringOpt === '1' || recurringOpt === 'true';
      const recurring_start_date = String(options.recurring_start_date || '');
      const recurring_end_date = String(options.recurring_end_date || '');
      const refFrom = String(options.ref || '');
      const sid = String(options.sid || '');
      const categoryOptions = type === 'income' ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
      const catIndex = category ? Math.max(0, categoryOptions.findIndex(opt => opt.label === category)) : -1;
      this.setData({
        form: {
          type,
          category,
          amount,
          planned,
          recurring_monthly: recurring,
          recurring_start_date: recurring_start_date || (recurring ? date : ''),
          recurring_end_date: recurring_end_date || '',
          date,
          note
        },
        hidden: { account_id: null, tenancy_id: null, account_name, tenant_name },
        categoryOptions,
        categoryIndex: catIndex,
        categoryDisplay: category || '请选择类别',
        refFrom,
        syntheticId: sid
      });
      try { if (refFrom === 'detail') wx.setNavigationBarTitle({ title: '编辑收支' }); } catch (e) {}
      const activePage = planned ? 'budget' : 'final';
      this.setData({ activePage });
    }
  },
  async prefill(id) {
    try {
      const item = await api.getCashflow(id);
      const categoryOptions = item.type === "income" ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
      const categoryIndex = Math.max(0, categoryOptions.findIndex((opt) => opt.label === item.category));
      const cycleIdx = (() => {
        const note = String(item.note || "");
        if (/\[周期:每月\]/.test(note)) return 1;
        if (/\[周期:每季度\]/.test(note)) return 2;
        if (/\[周期:每半年\]/.test(note)) return 3;
        if (/\[周期:每年\]/.test(note)) return 4;
        return item.recurring_monthly ? 1 : 0;
      })();
      this.setData({
        form: {
          type: item.type,
          category: item.category,
          amount: String(item.amount),
          planned: !!item.planned,
          recurring_monthly: !!item.recurring_monthly,
          recurring_start_date: (item.recurring_start_date || ''),
          recurring_end_date: (item.recurring_end_date || ''),
          date: item.date,
          note: item.note || ""
        },
        hidden: { account_id: item.account_id || null, tenancy_id: item.tenancy_id || null, account_name: item.account_name || "", tenant_name: item.tenant_name || "" },
        categoryOptions,
        categoryIndex,
        categoryDisplay: categoryOptions[categoryIndex]?.label || "请选择类别",
        recurringIndex: cycleIdx
      });
      const activePage = item.planned ? 'budget' : 'final';
      this.setData({ activePage });
    } catch (e) {}
  },
  handleInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },
  handleTypeToggle(e) {
    const value = String(e.currentTarget.dataset.value || "expense");
    if (value !== 'income' && value !== 'expense') return;
    const categoryOptions = value === "income" ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
    this.setData({
      "form.type": value,
      categoryOptions,
      categoryIndex: -1,
      "form.category": "",
      categoryDisplay: "请选择类别"
    });
  },
  handleCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    const label = this.data.categoryOptions[categoryIndex]?.label || "";
    this.setData({
      categoryIndex,
      "form.category": label,
      categoryDisplay: label || "请选择类别"
    });
  },
  handleDateChange(e) {
    this.setData({ "form.date": e.detail.value });
  },
  handleRecurringCycleChange(e) {
    const idx = Number(e.detail.value || 0);
    const monthly = idx === 1;
    const hasRepeat = idx > 0;
    const start = this.data.form.recurring_start_date || this.data.form.date || this.formatDate(new Date());
    this.setData({ recurringIndex: idx, "form.recurring_monthly": monthly, "form.recurring_start_date": hasRepeat ? start : '', "form.recurring_end_date": hasRepeat ? (this.data.form.recurring_end_date || '') : '' });
  },
  handleRecurringStartChange(e) {
    this.setData({ "form.recurring_start_date": e.detail.value });
  },
  handleRecurringEndChange(e) {
    this.setData({ "form.recurring_end_date": e.detail.value });
  },
  async submit() {
    const { type, category, amount, date } = this.data.form;
    if (!type || !category || !amount || !date) {
      wx.showToast({ title: "请完善必填项", icon: "none" });
      return;
    }
    const isRent = String(this.data.form.type || '') === 'income' && String(this.data.form.category || '') === '租金收入';
    if (isRent && !(this.data.hidden.account_id || String(this.data.hidden.account_name || '').trim())) {
      wx.showToast({ title: "请选择资产或填写资产名称", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const planned = this.data.activePage === 'budget';
      const recurring_monthly = this.data.recurringIndex === 1;
      const cycleTag = (() => {
        const idx = this.data.recurringIndex;
        if (idx === 1) return '[周期:每月]';
        if (idx === 2) return '[周期:每季度]';
        if (idx === 3) return '[周期:每半年]';
        if (idx === 4) return '[周期:每年]';
        return '';
      })();
      let note = String(this.data.form.note || '');
      note = note.replace(/\[周期:[^\]]+\]/g, '').trim();
      if (cycleTag) note = note ? `${note} ${cycleTag}` : cycleTag;
      const payload = { ...this.data.form, note, planned, recurring_monthly, amount: Number(this.data.form.amount), account_id: this.data.hidden.account_id, tenancy_id: this.data.hidden.tenancy_id, account_name: this.data.hidden.account_name, tenant_name: this.data.hidden.tenant_name };
      if (this.data.editId) {
        await api.updateCashflow(this.data.editId, payload);
        wx.showToast({ title: "更新成功", icon: "success" });
        wx.navigateBack();
      } else {
        const created = await api.createCashflow(payload);
        wx.showToast({ title: "记录成功", icon: "success" });
        if (this.data.refFrom === 'detail' && created && created.id) {
          wx.redirectTo({ url: `/pages/cashflow-detail/index?id=${created.id}` });
        } else {
          wx.navigateBack();
        }
      }
    } catch (e) {
      wx.showToast({ title: "提交失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
});
