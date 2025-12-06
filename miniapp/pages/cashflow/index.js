const api = require("../../utils/api");

Page({
  data: {
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
    typeOptions: [
      { label: "支出", value: "expense" },
      { label: "收入", value: "income" }
    ],
    typeIndex: 0,
    typeLabel: "支出",
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
      { label: "娱乐休闲" },
      { label: "服饰美妆" },
      { label: "日用品" },
      { label: "借款还款" },
      { label: "其他支出" }
    ],
    categoryOptions: []
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
      typeIndex: 0,
      typeLabel: "支出",
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
      const typeIndex = type === 'income' ? 1 : 0;
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
        typeIndex,
        typeLabel: type === 'income' ? '收入' : '支出',
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
      const typeIndex = type === 'income' ? 1 : 0;
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
        typeIndex,
        typeLabel: type === 'income' ? '收入' : '支出',
        categoryOptions,
        categoryIndex: catIndex,
        categoryDisplay: category || '请选择类别',
        refFrom,
        syntheticId: sid
      });
      try { if (refFrom === 'detail') wx.setNavigationBarTitle({ title: '编辑收支' }); } catch (e) {}
    }
  },
  getMasterStartDate(type, category, note) {
    try {
      const key = `${String(type || '')}:${String(category || '')}:${String(note || '')}`;
      const masters = wx.getStorageSync('fw_recurring_masters');
      if (masters && typeof masters === 'object' && masters[key]) {
        return masters[key].start_date || '';
      }
    } catch (e) {}
    return '';
  },
  getMasterEndDate(type, category, note) {
    try {
      const key = `${String(type || '')}:${String(category || '')}:${String(note || '')}`;
      const masters = wx.getStorageSync('fw_recurring_masters');
      if (masters && typeof masters === 'object' && masters[key]) {
        return masters[key].end_date || '';
      }
    } catch (e) {}
    return '';
  },
  async prefill(id) {
    try {
      const item = await api.getCashflow(id);
      const typeIndex = item.type === "income" ? 1 : 0;
      const categoryOptions = item.type === "income" ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
      const categoryIndex = Math.max(0, categoryOptions.findIndex((opt) => opt.label === item.category));
      const masterStart = this.getMasterStartDate(item.type, item.category, item.note || '');
      const masterEnd = this.getMasterEndDate(item.type, item.category, item.note || '');
      this.setData({
        form: {
          type: item.type,
          category: item.category,
          amount: String(item.amount),
          planned: !!item.planned,
          recurring_monthly: !!item.recurring_monthly,
          recurring_start_date: (item.recurring_start_date || masterStart || ''),
          recurring_end_date: (item.recurring_end_date || masterEnd || ''),
          date: item.date,
          note: item.note || ""
        },
        hidden: { account_id: item.account_id || null, tenancy_id: item.tenancy_id || null, account_name: item.account_name || "", tenant_name: item.tenant_name || "" },
        typeIndex,
        typeLabel: item.type === "income" ? "收入" : "支出",
        categoryOptions,
        categoryIndex,
        categoryDisplay: categoryOptions[categoryIndex]?.label || "请选择类别"
      });
    } catch (e) {}
  },
  handleInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },
  handleTypeChange(e) {
    const typeIndex = Number(e.detail.value);
    const value = this.data.typeOptions[typeIndex].value;
    const categoryOptions = value === "income" ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
    this.setData({
      "form.type": value,
      typeIndex,
      typeLabel: value === "income" ? "收入" : "支出",
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
  handlePlannedChange(e) {
    this.setData({ "form.planned": !!e.detail.value });
  },
  handleRecurringChange(e) {
    const on = !!e.detail.value;
    const start = this.data.form.recurring_start_date || this.data.form.date || this.formatDate(new Date());
    this.setData({ "form.recurring_monthly": on, "form.recurring_start_date": on ? start : '', "form.recurring_end_date": on ? (this.data.form.recurring_end_date || '') : '' });
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
      const payload = { ...this.data.form, amount: Number(this.data.form.amount), account_id: this.data.hidden.account_id, tenancy_id: this.data.hidden.tenancy_id, account_name: this.data.hidden.account_name, tenant_name: this.data.hidden.tenant_name };
      if (payload.hasOwnProperty('recurring_start_date')) delete payload.recurring_start_date;
      if (payload.hasOwnProperty('recurring_end_date')) delete payload.recurring_end_date;
      if (this.data.editId) {
        await api.updateCashflow(this.data.editId, payload);
        try {
          if (this.data.form.planned && this.data.form.recurring_monthly && this.data.form.recurring_start_date) {
            let masters = wx.getStorageSync('fw_recurring_masters');
            if (!masters || typeof masters !== 'object') masters = {};
            const key = `${this.data.form.type}:${this.data.form.category}:${this.data.form.note || ''}`;
            masters[key] = {
              key,
              type: this.data.form.type,
              category: this.data.form.category,
              note: this.data.form.note || '',
              amount: Number(this.data.form.amount),
              start_date: this.data.form.recurring_start_date,
              end_date: this.data.form.recurring_end_date || '',
              account_name: this.data.hidden.account_name || '',
              tenant_name: this.data.hidden.tenant_name || '',
              id: this.data.editId
            };
            wx.setStorageSync('fw_recurring_masters', masters);
          }
        } catch (e) {}
        wx.showToast({ title: "更新成功", icon: "success" });
        wx.navigateBack();
      } else {
        const created = await api.createCashflow(payload);
        try {
          if (this.data.form.planned && this.data.form.recurring_monthly && this.data.form.recurring_start_date) {
            let masters = wx.getStorageSync('fw_recurring_masters');
            if (!masters || typeof masters !== 'object') masters = {};
            const key = `${this.data.form.type}:${this.data.form.category}:${this.data.form.note || ''}`;
            masters[key] = {
              key,
              type: this.data.form.type,
              category: this.data.form.category,
              note: this.data.form.note || '',
              amount: Number(this.data.form.amount),
              start_date: this.data.form.recurring_start_date,
              end_date: this.data.form.recurring_end_date || '',
              account_name: this.data.hidden.account_name || '',
              tenant_name: this.data.hidden.tenant_name || '',
              id: created && created.id ? created.id : undefined
            };
            wx.setStorageSync('fw_recurring_masters', masters);
          }
        } catch (e) {}
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
