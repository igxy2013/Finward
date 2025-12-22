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
      { label: "对外投资" },
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
      { label: "对外投资" },
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
    editId: null,
    showCategorySelector: false,
    categoryOptionsWithIcon: []
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
    ,pageTitle: "添加账户"
    ,nKeyboardVisible: false
    ,nKeyboardValue: ''
    ,nKeyboardTitle: ''
    ,nKeyboardMaxLength: 10
    ,nKeyboardMaxDecimals: 2
    ,nKeyboardTargetKey: ''
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
      this.setData({ editId: id, incomingTenancyId: tenancyId || null, pageTitle: "编辑账户" });
      this.prefillFromServer(id);
    }
  },
  onShow() {
    try {
      const ac = wx.getStorageSync('fw_asset_categories');
      const lc = wx.getStorageSync('fw_liability_categories');
      const assetCats = Array.isArray(ac) && ac.length ? ac.map(label => ({ label })) : this.data.assetCategoryOptions.map(o => ({ label: o.label }));
      const liabCats = Array.isArray(lc) && lc.length ? lc.map(label => ({ label })) : this.data.liabilityCategoryOptions.map(o => ({ label: o.label }));
      const isAsset = (this.data.form?.type || 'asset') === 'asset';
      const categoryOptions = isAsset ? assetCats : liabCats;
      this.setData({ assetCategoryOptions: assetCats, liabilityCategoryOptions: liabCats, categoryOptions });
      this.updateCategoryOptionsWithIcon();
    } catch (e) {}
  },
  async prefillFromServer(id) {
    try {
      const api = require("../../utils/api");
      const item = await api.getAccount(id);
      const typeIndex = item.type === "liability" ? 1 : 0;
      const normalizeCat = (raw) => {
        const s = String(raw || "").trim();
        if (!s) return "其他";
        if (/(新能源)?充电站|光伏(发电站)?/i.test(s)) return "对外投资";
        return s;
      };
      const displayCat = item.type === "asset" ? normalizeCat(item.category) : item.category;
      const categoryOptions = item.type === "asset" ? this.data.assetCategoryOptions : this.data.liabilityCategoryOptions;
      const categoryIndex = Math.max(0, categoryOptions.findIndex((opt) => opt.label === displayCat));
      this.setData({
        form: {
          name: item.name || "",
          type: item.type || "asset",
          category: displayCat || "",
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
      this.updateCategoryOptionsWithIcon();
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
      this.updateCategoryOptionsWithIcon();
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
  openNKeyboard(e) {
    const key = String(e.currentTarget.dataset.key || 'amount');
    const title = String(e.currentTarget.dataset.title || '输入');
    const current = String((this.data.form || {})[key] || '');
    const integerOnly = (key === 'loan_term_months' || key === 'investment_term_months');
    const maxDecimals = integerOnly ? 0 : 2;
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
    if (key === "amount" || key === "depreciation_rate" || key === "annual_interest_rate" || key === "monthly_payment" || key === "loan_term_months") this.recomputeCurrentValue();
    if (key === "loan_term_months") this.recomputeEndDates();
  },
  onNKeyboardConfirm(e) {
    this.setData({ nKeyboardVisible: false });
  },
  onNKeyboardSave(e) {
    const v = String(e.detail.value || '');
    const key = this.data.nKeyboardTargetKey || 'amount';
    this.setData({ [`form.${key}`]: v, nKeyboardVisible: false });
    if (key === "amount" || key === "depreciation_rate" || key === "annual_interest_rate" || key === "monthly_payment" || key === "loan_term_months") this.recomputeCurrentValue();
    if (key === "loan_term_months") this.recomputeEndDates();
    if (typeof this.submit === 'function') this.submit();
  },
  onNKeyboardClose() {
    this.setData({ nKeyboardVisible: false });
  },
  handleTenantDueDayChange(e) {
    // 已移除出租详细表单，此方法不再使用
  },
  handleTenantStartDate(e) {
    // 已移除出租详细表单，此方法不再使用
  },
  handleTenantEndDate(e) {
    // 已移除出租详细表单，此方法不再使用
  },
  handleTenantReminderToggle(e) {
    // 已移除出租详细表单，此方法不再使用
  },
  handleRentalToggle(e) {
    this.setData({ "form.rental_enabled": !!e.detail.value });
  },
  handleTenantFrequencyChange(e) {
    // 已移除出租详细表单，此方法不再使用
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
    // 房产类资产不使用投资期限，强制视为0
    const termInvest = (this.data.form.category === '房产') ? 0 : Number(this.data.form.investment_term_months || 0);
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
    this.updateCategoryOptionsWithIcon();
  },
  handleTypeToggle(e) {
    const value = String(e?.currentTarget?.dataset?.value || 'asset');
    const typeIndex = value === 'asset' ? 0 : 1;
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
    this.updateCategoryOptionsWithIcon();
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
  openCategorySelector() {
    this.setData({ showCategorySelector: true });
  },
  closeCategorySelector() {
    this.setData({ showCategorySelector: false });
  },
  onCategorySelected(e) {
    const idx = Number(e?.detail?.index || 0);
    const opt = (this.data.categoryOptions || [])[idx];
    const label = opt?.label || "";
    this.setData({
      "form.category": label,
      categoryIndex: idx,
      categoryDisplay: label || "请选择分类",
      showCategorySelector: false
    });
  },
  updateCategoryOptionsWithIcon() {
    const opts = (this.data.categoryOptions || []).map((o) => ({ label: o.label, icon: this.getIconForLabel(String(o.label || '')) }));
    this.setData({ categoryOptionsWithIcon: opts });
  },
  getIconForLabel(label) {
    const t = (this.data.form?.type || 'asset');
    const m = {
      asset: {
        "现金": "/assets/icons/wallet-3-line.svg",
        "储蓄卡": "/assets/icons/wallet-2-line.svg",
        "活期": "/assets/icons/time-line.svg",
        "定期": "/assets/icons/calendar-line.svg",
        "基金": "/assets/icons/bar-chart-2-line.svg",
        "股票": "/assets/icons/line-chart-line.svg",
        "理财": "/assets/icons/percent-line.svg",
        "房产": "/assets/icons/home-4-line.svg",
        "车辆": "/assets/icons/car-line.svg",
        "应收款": "/assets/icons/coin-line.svg",
        "对外投资": "/assets/icons/building-line.svg",
        "其他": "/assets/icons/more-line.svg"
      },
      liability: {
        "信用卡": "/assets/icons/wallet-2-line.svg",
        "消费贷": "/assets/icons/shopping-bag-line.svg",
        "房贷": "/assets/icons/home-4-line.svg",
        "车贷": "/assets/icons/car-line.svg",
        "借款": "/assets/icons/hand-coin-line.svg",
        "应付款": "/assets/icons/bill-line.svg",
        "其他": "/assets/icons/more-line.svg"
      }
    };
    const dict = m[t] || m.asset;
    return dict[label] || "/assets/icons/question-line.svg";
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
        investment_term_months: (f.category !== '房产' && f.investment_term_months !== "") ? Number(f.investment_term_months) : null,
        monthly_income: (f.category !== '房产' && f.monthly_income !== "") ? Number(f.monthly_income) : null,
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
      // 出租相关信息交由“出租详情”页面与弹窗组件单独管理
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
  ,goRentDetail() {
    const id = Number(this.data.editId || 0);
    if (!id) {
      wx.showToast({ title: "请先保存资产", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/rent-detail/index?id=${id}` });
  }
});
