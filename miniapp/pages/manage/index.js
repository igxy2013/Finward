const api = require("../../utils/api");

Page({
  data: {
    form: {
      name: "",
      type: "asset",
      category: "",
      amount: "",
      note: "",
      loan_term_months: "",
      monthly_payment: "",
      annual_interest_rate: "",
      loan_start_date: "",
      loan_end_date: "",
      investment_term_months: "",
      monthly_income: "",
      invest_start_date: "",
      invest_end_date: "",
      depreciation_rate: "", // 显示为百分比值，如 10 表示 10%
      rental_enabled: false,
      tenant_name: "",
      tenant_monthly_rent: "",
      tenant_due_day: 0,
      tenant_start_date: "",
      tenant_end_date: "",
      tenant_contract_number: "",
      tenant_contract_url: "",
      tenant_reminder_enabled: true
    },
    submitting: false,
    typeIndex: 0,
    categoryIndex: -1,
    typeLabel: "资产",
    categoryDisplay: "请选择分类",
    typeOptions: [
      { label: "资产", value: "asset" },
      { label: "负债", value: "liability" }
    ],
    categoryOptions: [
      { label: "现金" },
      { label: "储蓄卡" },
      { label: "活期" },
      { label: "定期" },
      { label: "基金" },
      { label: "股票" },
      { label: "理财" },
      { label: "房产" },
      { label: "车辆" },
      { label: "应收款" },
      { label: "光伏发电站" },
      { label: "新能源充电站" },
      { label: "其他" }
    ],
    assetCategoryOptions: [
      { label: "现金" },
      { label: "储蓄卡" },
      { label: "活期" },
      { label: "定期" },
      { label: "基金" },
      { label: "股票" },
      { label: "理财" },
      { label: "房产" },
      { label: "车辆" },
      { label: "应收款" },
      { label: "光伏发电站" },
      { label: "新能源充电站" },
      { label: "其他" }
    ],
    liabilityCategoryOptions: [
      { label: "信用卡" },
      { label: "消费贷" },
      { label: "房贷" },
      { label: "车贷" },
      { label: "借款" },
      { label: "应付款" },
      { label: "其他" }
    ],
    editId: null
    ,current_value_display: ""
    ,tenantDueDays: Array.from({ length: 31 }, (_, i) => i + 1)
    ,tenantDueDayIndex: 0
    ,currentTenancyId: null
    ,tenantFrequencyOptions: [
      { label: "每月", value: "monthly" },
      { label: "每季度", value: "quarterly" },
      { label: "每半年", value: "semiannual" },
      { label: "每年", value: "annual" }
    ]
    ,tenantFrequencyIndex: 0
    ,tenantFrequencyLabel: "每月"
  },
  clipTwoDecimals(val) {
    const s = String(val || "");
    const cleaned = s.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length === 1) return parts[0];
    const head = parts[0] || "0";
    const tail = (parts[1] || "").slice(0, 2);
    return tail ? `${head}.${tail}` : head;
  },
  roundTwo(val) {
    const n = Number(val);
    if (Number.isNaN(n)) return 0;
    return Number(n.toFixed(2));
  },
  onLoad(options) {
    const edit = options?.edit;
    const id = options?.id ? Number(options.id) : null;
    const tenancyId = options?.tenancy_id ? Number(options.tenancy_id) : null;
    if (edit && id) {
      this.setData({ editId: id, incomingTenancyId: tenancyId || null });
      this.prefillFromServer(id);
    }
  },
  async prefillFromServer(id) {
    try {
      const api = require("../../utils/api");
      const item = await api.getAccount(id);
      const typeIndex = item.type === "liability" ? 1 : 0;
      const categoryOptions = item.type === "asset" ? this.data.assetCategoryOptions : this.data.liabilityCategoryOptions;
      const categoryIndex = Math.max(0, categoryOptions.findIndex((opt) => opt.label === item.category));
      this.setData({
        form: {
          name: item.name || "",
          type: item.type || "asset",
          category: item.category || "",
          amount: (item.initial_amount != null ? this.clipTwoDecimals(String(item.initial_amount)) : (item.amount != null ? this.clipTwoDecimals(String(item.amount)) : "")),
          note: item.note || "",
          loan_term_months: item.loan_term_months != null ? String(item.loan_term_months) : "",
          monthly_payment: item.monthly_payment != null ? String(item.monthly_payment) : "",
          annual_interest_rate: item.annual_interest_rate != null ? String(Number(item.annual_interest_rate) * 100) : "",
          loan_start_date: item.loan_start_date || "",
          loan_end_date: item.loan_end_date || "",
          investment_term_months: item.investment_term_months != null ? String(item.investment_term_months) : "",
          monthly_income: item.monthly_income != null ? String(item.monthly_income) : "",
          invest_start_date: item.invest_start_date || "",
          invest_end_date: item.invest_end_date || "",
          depreciation_rate: item.depreciation_rate != null ? String(Number(item.depreciation_rate) * 100) : "",
          rental_enabled: false,
          tenant_name: "",
          tenant_monthly_rent: "",
          tenant_due_day: 0,
          tenant_start_date: "",
          tenant_end_date: "",
          tenant_contract_number: "",
          tenant_contract_url: "",
          tenant_reminder_enabled: true
        },
        typeIndex,
        typeLabel: item.type === "liability" ? "负债" : "资产",
        categoryOptions,
        categoryIndex,
        categoryDisplay: categoryOptions[categoryIndex]?.label || "请选择分类",
        current_value_display: this.clipTwoDecimals(String(item.current_value != null ? item.current_value : item.amount))
      });
      this.recomputeEndDates();
      if ((item.type || "asset") === "asset" && (item.category || "") === "房产") {
        try {
          const tenants = await api.listTenants(id);
          if (tenants && tenants.length > 0) {
            const t = (this.data.incomingTenancyId ? tenants.find(x => Number(x.id) === Number(this.data.incomingTenancyId)) : null) || tenants[0];
            const idx = Math.max(0, this.data.tenantDueDays.findIndex((d) => Number(d) === Number(t.due_day)));
            this.setData({
              tenantDueDayIndex: idx,
              tenantFrequencyIndex: Math.max(0, this.data.tenantFrequencyOptions.findIndex(o => (o.value || o) === (t.frequency || 'monthly'))),
              tenantFrequencyLabel: (this.data.tenantFrequencyOptions.find(o => o.value === (t.frequency || 'monthly')) || this.data.tenantFrequencyOptions[0]).label,
              form: {
                ...this.data.form,
                rental_enabled: true,
                tenant_name: t.tenant_name || "",
                tenant_monthly_rent: String(t.monthly_rent || ""),
                tenant_due_day: Number(t.due_day || 0),
                tenant_start_date: t.start_date || "",
                tenant_end_date: t.end_date || "",
                tenant_contract_number: t.contract_number || "",
                tenant_contract_url: t.contract_url || "",
                tenant_reminder_enabled: !!t.reminder_enabled,
                tenant_frequency: t.frequency || "monthly"
              },
              currentTenancyId: t.id
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      let item = null;
      try { item = wx.getStorageSync("fw_edit_item"); } catch (err) {}
      if (!item || Number(item.id) !== id) return;
      const typeIndex = item.type === "liability" ? 1 : 0;
      const categoryOptions = item.type === "asset" ? this.data.assetCategoryOptions : this.data.liabilityCategoryOptions;
      const categoryIndex = Math.max(0, categoryOptions.findIndex((opt) => opt.label === item.category));
      this.setData({
        form: {
          name: item.name || "",
          type: item.type || "asset",
          category: item.category || "",
          amount: (item.initial_amount != null ? this.clipTwoDecimals(String(item.initial_amount)) : (item.amount != null ? this.clipTwoDecimals(String(item.amount)) : "")),
          note: item.note || "",
          loan_term_months: item.loan_term_months != null ? String(item.loan_term_months) : "",
          monthly_payment: item.monthly_payment != null ? String(item.monthly_payment) : "",
          annual_interest_rate: item.annual_interest_rate != null ? String(Number(item.annual_interest_rate) * 100) : "",
          loan_start_date: item.loan_start_date || "",
          investment_term_months: item.investment_term_months != null ? String(item.investment_term_months) : "",
          monthly_income: item.monthly_income != null ? String(item.monthly_income) : "",
          invest_start_date: item.invest_start_date || "",
          depreciation_rate: item.depreciation_rate != null ? String(Number(item.depreciation_rate) * 100) : "",
          rental_enabled: false,
          tenant_name: "",
          tenant_monthly_rent: "",
          tenant_due_day: 0,
          tenant_start_date: "",
          tenant_end_date: "",
          tenant_contract_number: "",
          tenant_contract_url: "",
          tenant_reminder_enabled: true
        },
        typeIndex,
        typeLabel: item.type === "liability" ? "负债" : "资产",
        categoryOptions,
        categoryIndex,
        categoryDisplay: categoryOptions[categoryIndex]?.label || "请选择分类",
        current_value_display: this.clipTwoDecimals(String(item.current_value != null ? item.current_value : item.amount))
      });
      this.recomputeEndDates();
    }
  },
  handleDateChangeAsset(e) {
      this.setData({ "form.invest_start_date": e.detail.value });
    this.recomputeCurrentValue();
    this.recomputeEndDates();
  },
  handleDateChangeLoan(e) {
    this.setData({ "form.loan_start_date": e.detail.value });
    this.recomputeCurrentValue();
    this.recomputeEndDates();
  },
  handleInput(e) {
    const key = e.currentTarget.dataset.key;
    let v = e.detail.value;
    if (key === "amount") v = this.clipTwoDecimals(v);
    this.setData({ [`form.${key}`]: v });
    if (key === "amount" || key === "depreciation_rate" || key === "annual_interest_rate" || key === "monthly_payment" || key === "loan_term_months") this.recomputeCurrentValue();
    if (key === "loan_term_months") this.recomputeEndDates();
  },
  handleTenantDueDayChange(e) {
    const idx = Number(e.detail.value || 0);
    const day = this.data.tenantDueDays[idx];
    this.setData({ tenantDueDayIndex: idx, "form.tenant_due_day": Number(day) });
  },
  handleTenantStartDate(e) {
    this.setData({ "form.tenant_start_date": e.detail.value });
  },
  handleTenantEndDate(e) {
    this.setData({ "form.tenant_end_date": e.detail.value });
  },
  handleTenantReminderToggle(e) {
    this.setData({ "form.tenant_reminder_enabled": !!e.detail.value });
  },
  handleRentalToggle(e) {
    this.setData({ "form.rental_enabled": !!e.detail.value });
  },
  handleTenantFrequencyChange(e) {
    const idx = Number(e.detail.value || 0);
    const opt = this.data.tenantFrequencyOptions[idx] || this.data.tenantFrequencyOptions[0];
    this.setData({ tenantFrequencyIndex: idx, tenantFrequencyLabel: opt.label, "form.tenant_frequency": opt.value });
  },
  recomputeCurrentValue() {
    const base = Number(this.data.form.amount || 0);
    if (this.data.form.type === "asset") {
      const ratePct = Number(this.data.form.depreciation_rate || 0);
      const rate = ratePct / 100;
      const startStr = this.data.form.invest_start_date;
      if (!startStr || !base || !ratePct) {
        this.setData({ current_value_display: this.clipTwoDecimals(String(base || 0)) });
        return;
      }
      const now = new Date();
      const start = new Date(startStr.replace(/-/g, "/"));
      const days = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
      const years = days / 365.25;
      const current = Math.max(0, base * (1 - rate * years));
      this.setData({ current_value_display: this.clipTwoDecimals(String(current)) });
    } else {
      const mp = Number(this.data.form.monthly_payment || 0);
      const startStr = this.data.form.loan_start_date;
      const term = Number(this.data.form.loan_term_months || 0);
      const ratePct = Number(this.data.form.annual_interest_rate || 0);
      if (!startStr || !base || !mp) {
        this.setData({ current_value_display: this.clipTwoDecimals(String(base || 0)) });
        return;
      }
      const now = new Date();
      const start = new Date(startStr.replace(/-/g, "/"));
      const monthsElapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
      const paymentsPossible = Math.floor(base / mp);
      const limit = term > 0 ? term : monthsElapsed;
      const paidMonths = Math.min(monthsElapsed, limit, paymentsPossible);
      const remainingMonths = Math.max(0, (limit || 0) - paidMonths);
      const r = ratePct > 0 ? (ratePct / 100) / 12 : 0;
      let current = 0;
      if (r > 0 && remainingMonths > 0) {
        current = mp * (1 - Math.pow(1 + r, -remainingMonths)) / r;
      } else {
        current = Math.max(0, base - mp * paidMonths);
      }
      this.setData({ current_value_display: this.clipTwoDecimals(String(current)) });
    }
  },
  recomputeEndDates() {
    // 负债结束日期：按开始日期 + 期限(月) 自动计算
    const startLoan = this.data.form.loan_start_date;
    const termLoan = Number(this.data.form.loan_term_months || 0);
    let loanEnd = "";
    if (startLoan && termLoan > 0) {
      const s = new Date(String(startLoan).replace(/-/g, "/"));
      if (!isNaN(s.getTime())) {
        const y = s.getFullYear();
        const m = s.getMonth();
        const d = s.getDate();
        // 最后一期所在月份：开始月 + 期限 - 1
        const endMonthIdx = m + termLoan - 1;
        const endDate = new Date(y, endMonthIdx + 1, 0); // 该月最后一天
        const day = Math.min(d, endDate.getDate());
        const finalDate = new Date(y, endMonthIdx, day);
        const yy = finalDate.getFullYear();
        const mm = String(finalDate.getMonth() + 1).padStart(2, '0');
        const dd = String(finalDate.getDate()).padStart(2, '0');
        loanEnd = `${yy}-${mm}-${dd}`;
      }
    }
    // 资产结束日期：如设置了投资期限则按开始日期 + 期限(月) 计算，否则保留用户设置
    const startInvest = this.data.form.invest_start_date;
    const termInvest = Number(this.data.form.investment_term_months || 0);
    let investEnd = this.data.form.invest_end_date || "";
    if (startInvest && termInvest > 0) {
      const s = new Date(String(startInvest).replace(/-/g, "/"));
      if (!isNaN(s.getTime())) {
        const y = s.getFullYear();
        const m = s.getMonth();
        const d = s.getDate();
        const endMonthIdx = m + termInvest - 1;
        const endDate = new Date(y, endMonthIdx + 1, 0);
        const day = Math.min(d, endDate.getDate());
        const finalDate = new Date(y, endMonthIdx, day);
        const yy = finalDate.getFullYear();
        const mm = String(finalDate.getMonth() + 1).padStart(2, '0');
        const dd = String(finalDate.getDate()).padStart(2, '0');
        investEnd = `${yy}-${mm}-${dd}`;
      }
    }
    this.setData({ "form.loan_end_date": loanEnd, "form.invest_end_date": investEnd });
  },
  handleTypeChange(e) {
    const typeIndex = Number(e.detail.value);
    const value = this.data.typeOptions[typeIndex].value;
    const categoryOptions = value === "asset" ? this.data.assetCategoryOptions : this.data.liabilityCategoryOptions;
    this.setData({
      "form.type": value,
      categoryOptions,
      "form.category": "",
      categoryIndex: -1,
      typeIndex,
      typeLabel: value === "asset" ? "资产" : "负债",
      categoryDisplay: "请选择分类"
    });
  },
  handleCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    const options = this.data.form.type === "asset" ? this.data.assetCategoryOptions : this.data.liabilityCategoryOptions;
    const label = options[categoryIndex]?.label || "";
    this.setData({
      "form.category": label,
      categoryIndex,
      categoryDisplay: label || "请选择分类"
    });
  },
  async submit() {
    const { name, category, amount } = this.data.form;
    if (!name || !category || !amount) {
      wx.showToast({ title: "请完善必填项", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const f = this.data.form;
      const payload = {
        name: f.name,
        type: f.type,
        category: f.category,
        amount: this.roundTwo(f.amount),
        note: f.note || null,
        loan_term_months: f.loan_term_months !== "" ? Number(f.loan_term_months) : null,
        monthly_payment: f.monthly_payment !== "" ? Number(f.monthly_payment) : null,
        loan_start_date: f.loan_start_date || null,
        loan_end_date: f.loan_end_date || null,
        annual_interest_rate: f.annual_interest_rate !== "" ? Number(f.annual_interest_rate) / 100 : null,
        investment_term_months: f.investment_term_months !== "" ? Number(f.investment_term_months) : null,
        monthly_income: f.monthly_income !== "" ? Number(f.monthly_income) : null,
        invest_start_date: f.invest_start_date || null,
        invest_end_date: f.invest_end_date || null,
        depreciation_rate: f.depreciation_rate !== "" ? Number(f.depreciation_rate) / 100 : null
      };
      let accountId = this.data.editId || null;
      if (this.data.editId) {
        const updated = await api.updateAccount(this.data.editId, payload);
        accountId = updated?.id || this.data.editId;
        wx.showToast({ title: "更新成功", icon: "success" });
      } else {
        const created = await api.createAccount(payload);
        accountId = created?.id || null;
        wx.showToast({ title: "记录成功", icon: "success" });
      }
      if (this.data.form.type === "asset" && this.data.form.category === "房产" && accountId && this.data.form.rental_enabled) {
        const tf = this.data.form;
        const tenantPayload = {
          account_id: accountId,
          tenant_name: tf.tenant_name || "",
          monthly_rent: tf.tenant_monthly_rent !== "" ? Number(tf.tenant_monthly_rent) : 0,
          frequency: tf.tenant_frequency || (this.data.tenantFrequencyOptions[this.data.tenantFrequencyIndex]?.value || "monthly"),
          due_day: Number(tf.tenant_due_day || 0),
          start_date: tf.tenant_start_date || null,
          end_date: tf.tenant_end_date || null,
          contract_number: tf.tenant_contract_number || null,
          contract_url: tf.tenant_contract_url || null,
          reminder_enabled: !!tf.tenant_reminder_enabled,
          note: tf.note || null
        };
        try {
          if (this.data.currentTenancyId) {
            await api.updateTenant(this.data.currentTenancyId, tenantPayload);
          } else {
            const hasCore = !!(tf.tenant_name || tf.tenant_monthly_rent || tf.tenant_start_date);
            if (hasCore) {
              await api.createTenant(tenantPayload);
            }
          }
        } catch (e) {}
      }
      if (this.data.editId) {
        try {
          const pages = getCurrentPages();
          const prev = pages && pages.length >= 2 ? pages[pages.length - 2] : null;
          if (prev && typeof prev.fetchDetail === 'function') {
            await prev.fetchDetail(accountId);
          }
        } catch (e) {}
        wx.navigateBack();
      } else {
        this.setData({
          form: {
            name: "",
            type: this.data.form.type,
            category: "",
            amount: "",
            note: "",
            loan_term_months: "",
            monthly_payment: "",
            annual_interest_rate: "",
            investment_term_months: "",
            monthly_income: "",
            invest_start_date: "",
            depreciation_rate: "",
            rental_enabled: false,
            tenant_name: "",
            tenant_monthly_rent: "",
            tenant_due_day: 0,
            tenant_start_date: "",
            tenant_end_date: "",
            tenant_contract_number: "",
            tenant_contract_url: "",
            tenant_reminder_enabled: true
          }
        });
      }
    } catch (error) {
      console.error(error);
      wx.showToast({ title: "提交失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
