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
      { label: "兼职" },
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
    recurringIndex: 0,
    showCategorySelector: false,
    categoryOptionsWithIcon: [],
    nKeyboardVisible: false,
    nKeyboardValue: '',
    nKeyboardTitle: '',
    nKeyboardMaxLength: 10,
    nKeyboardMaxDecimals: 2,
    nKeyboardTargetKey: ''
  },
  handlePageSwitch(e) {
    const val = String(e.currentTarget.dataset.value || "budget");
    if (val === this.data.activePage) return;
    const planned = (val === 'budget');
    if (!planned) {
      this.setData({
        activePage: val,
        "form.planned": false,
        recurringIndex: 0,
        "form.recurring_monthly": false,
        "form.recurring_start_date": '',
        "form.recurring_end_date": ''
      });
    } else {
      this.setData({ activePage: val, "form.planned": true });
    }
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
    const buildOpts = (opts, type) => (opts || []).map(o => ({ label: o.label, icon: `/assets/icons/${getCategoryIcon(o.label, type)}` }));
    this.setData({
      "form.date": today,
      "form.recurring_start_date": "",
      "form.recurring_end_date": "",
      activePage: "budget",
      categoryOptions: this.data.expenseCategoryOptions,
      categoryIndex: -1,
      categoryDisplay: "请选择类别",
      categoryOptionsWithIcon: buildOpts(this.data.expenseCategoryOptions, 'expense')
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
        categoryDisplay: category,
        categoryOptionsWithIcon: buildOpts(categoryOptions, type)
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
        syntheticId: sid,
        categoryOptionsWithIcon: buildOpts(categoryOptions, type)
      });
      try { if (refFrom === 'detail') wx.setNavigationBarTitle({ title: '编辑收支' }); } catch (e) {}
      const activePage = planned ? 'budget' : 'final';
      this.setData({ activePage });
      if (!planned) {
        this.setData({
          recurringIndex: 0,
          "form.recurring_monthly": false,
          "form.recurring_start_date": '',
          "form.recurring_end_date": ''
        });
      }
    }
  },
  onShow() {
    try {
      const ic = wx.getStorageSync('fw_income_categories');
      const ec = wx.getStorageSync('fw_expense_categories');
      const incomeCats = Array.isArray(ic) && ic.length ? ic.map(label => ({ label })) : this.data.incomeCategoryOptions.map(o => ({ label: o.label }));
      const expenseCats = Array.isArray(ec) && ec.length ? ec.map(label => ({ label })) : this.data.expenseCategoryOptions.map(o => ({ label: o.label }));
      const typeNow = this.data.form?.type || 'expense';
      const opts = typeNow === 'income' ? incomeCats : expenseCats;
      const withIcon = (opts || []).map(o => ({ label: o.label, icon: `/assets/icons/${getCategoryIcon(o.label, typeNow)}` }));
      this.setData({ incomeCategoryOptions: incomeCats, expenseCategoryOptions: expenseCats, categoryOptionsWithIcon: withIcon });
    } catch (e) {}
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
      if (!item.planned) {
        this.setData({
          recurringIndex: 0,
          "form.recurring_monthly": false,
          "form.recurring_start_date": '',
          "form.recurring_end_date": ''
        });
      }
    } catch (e) {}
  },
  handleInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },
  openNKeyboard(e) {
    const key = String(e.currentTarget.dataset.key || 'amount');
    const title = String(e.currentTarget.dataset.title || '输入');
    const current = String((this.data.form || {})[key] || '');
    const maxDecimals = key === 'amount' ? 2 : 0;
    const maxLength = 10;
    this.setData({
      nKeyboardVisible: true,
      nKeyboardValue: current,
      nKeyboardTitle: title,
      nKeyboardMaxLength: maxLength,
      nKeyboardMaxDecimals: maxDecimals,
      nKeyboardTargetKey: key
    });
  },
  onNKeyboardInput(e) {
    const v = String(e.detail.value || '');
    const key = this.data.nKeyboardTargetKey || 'amount';
    this.setData({ nKeyboardValue: v, [`form.${key}`]: v });
  },
  onNKeyboardConfirm(e) {
    this.setData({ nKeyboardVisible: false });
  },
  onNKeyboardSave(e) {
    const v = String(e.detail.value || '');
    const key = this.data.nKeyboardTargetKey || 'amount';
    this.setData({ [`form.${key}`]: v, nKeyboardVisible: false });
    if (typeof this.submit === 'function') this.submit();
  },
  onNKeyboardClose() {
    this.setData({ nKeyboardVisible: false });
  },
  handleTypeToggle(e) {
    const value = String(e.currentTarget.dataset.value || "expense");
    if (value !== 'income' && value !== 'expense') return;
    const categoryOptions = value === "income" ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
    const optsWithIcon = (categoryOptions || []).map(o => ({ label: o.label, icon: `/assets/icons/${getCategoryIcon(o.label, value)}` }));
    this.setData({
      "form.type": value,
      categoryOptions,
      categoryIndex: -1,
      "form.category": "",
      categoryDisplay: "请选择类别",
      categoryOptionsWithIcon: optsWithIcon
    });
  },
  openCategorySelector() {
    this.setData({ showCategorySelector: true });
  },
  closeCategorySelector() {
    this.setData({ showCategorySelector: false });
  },
  onCategorySelected(e) {
    const idx = Number(e.detail.index || 0);
    const opt = e.detail.option || {};
    const label = String(opt.label || '');
    this.setData({ categoryIndex: idx, "form.category": label, categoryDisplay: label, showCategorySelector: false });
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
        try { wx.setStorageSync('fw_cashflow_updated', { ts: Date.now() }); } catch (e) {}
        wx.navigateBack();
      } else {
        const created = await api.createCashflow(payload);
        wx.showToast({ title: "记录成功", icon: "success" });
        try { wx.setStorageSync('fw_cashflow_updated', { ts: Date.now() }); } catch (e) {}
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

const CATEGORY_ICON_MAP = {
  "工资": "briefcase-line.svg",
  "奖金": "coin-line.svg",
  "理财收益": "stock-line.svg",
  "分红": "hand-coin-line.svg",
  "投资回款": "money-dollar-circle-line.svg",
  "租金收入": "home-4-line.svg",
  "兼职": "briefcase-line.svg",
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
  "房贷月供": "home-4-line-red.svg",
  "车贷月供": "car-line-red.svg",
  "信用卡月供": "bank-line-red.svg",
  "消费贷月供": "wallet-line-red.svg",
  "借款月供": "wallet-line-red.svg",
  "应付款月供": "wallet-line-red.svg",
  "资产收益": "money-dollar-circle-line.svg",
  "其他收入": "add-circle-line.svg",
  "其他支出": "add-circle-line-red.svg"
};

function getCategoryIcon(category, type) {
  if (CATEGORY_ICON_MAP[category]) return CATEGORY_ICON_MAP[category];
  if (type === 'income') return "arrow-up-s-line.svg";
  return "arrow-down-s-line-red.svg";
}
