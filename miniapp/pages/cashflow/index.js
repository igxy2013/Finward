const api = require("../../utils/api");

Page({
  data: {
    form: {
      type: "expense",
      category: "",
      amount: "",
      planned: false,
      recurring_monthly: false,
      date: "",
      note: ""
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
  onLoad(options) {
    const edit = options?.edit;
    const id = options?.id ? Number(options.id) : null;
    const today = this.formatDate(new Date());
    this.setData({
      "form.date": today,
      typeIndex: 0,
      typeLabel: "支出",
      categoryOptions: this.data.expenseCategoryOptions,
      categoryIndex: -1,
      categoryDisplay: "请选择类别"
    });
    if (edit && id) {
      this.setData({ editId: id });
      this.prefill(id);
    }
  },
  async prefill(id) {
    try {
      const item = await api.getCashflow(id);
      const typeIndex = item.type === "income" ? 1 : 0;
      const categoryOptions = item.type === "income" ? this.data.incomeCategoryOptions : this.data.expenseCategoryOptions;
      const categoryIndex = Math.max(0, categoryOptions.findIndex((opt) => opt.label === item.category));
      this.setData({
        form: {
          type: item.type,
          category: item.category,
          amount: String(item.amount),
          planned: !!item.planned,
          recurring_monthly: !!item.recurring_monthly,
          date: item.date,
          note: item.note || ""
        },
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
    this.setData({ "form.recurring_monthly": !!e.detail.value });
  },
  async submit() {
    const { type, category, amount, date } = this.data.form;
    if (!type || !category || !amount || !date) {
      wx.showToast({ title: "请完善必填项", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const payload = { ...this.data.form, amount: Number(this.data.form.amount) };
      if (this.data.editId) {
        await api.updateCashflow(this.data.editId, payload);
        wx.showToast({ title: "更新成功", icon: "success" });
        wx.navigateBack();
      } else {
        await api.createCashflow(payload);
        wx.showToast({ title: "记录成功", icon: "success" });
        wx.navigateBack();
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
