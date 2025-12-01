const api = require("../../utils/api");

const LIABILITY_CATEGORY_ICONS = {
  "信用卡": "bank-line-red.svg",
  "消费贷": "wallet-line-red.svg",
  "房贷": "home-4-line-red.svg",
  "车贷": "car-line-red.svg",
  "借款": "money-cny-circle-line-red.svg",
  "应付款": "bill-line-red.svg",
  "其他": "wallet-line-red.svg"
};

Page({
  data: {
    loading: true,
    error: "",
    id: null,
    detail: {},
    icon: "bill-line-red.svg",
    change_positive: false,
    change_negative: false,
    change_sign: ""
  },
  onLoad(options) {
    const id = Number(options?.id);
    if (!id) {
      this.setData({ loading: false, error: "参数错误" });
      return;
    }
    this.setData({ id, loading: true, error: "" });
    this.fetchDetail(id);
  },
  async fetchDetail(id) {
    try {
      const data = await api.getAccount(id);
      const icon = this.getIcon(data.category);
      const current = this.parseNumber(data.current_value ?? data.amount);
      const initial = this.parseNumber(data.initial_amount ?? data.amount);
      const change = current - initial;
      const change_positive = change > 0;
      const change_negative = change < 0;
      const change_sign = change > 0 ? "+￥" : (change < 0 ? "-￥" : "￥");
      const detail = {
        ...data,
        current_value_display: this.formatNumber(current),
        initial_amount_display: this.formatNumber(initial),
        change_display: this.formatNumber(Math.abs(change)),
        updated_at_display: this.formatDate(data.updated_at),
        created_at_display: this.formatDate(data.created_at),
        next_due_date_display: data.next_due_date ? this.formatDate(data.next_due_date) : "",
        monthly_payment_display: data.monthly_payment ? this.formatNumber(data.monthly_payment) : "",
        loan_start_date_display: data.loan_start_date ? this.formatDate(data.loan_start_date) : ""
      };
      this.setData({ detail, icon, change_positive, change_negative, change_sign, loading: false });
    } catch (error) {
      this.setData({ loading: false, error: "加载失败" });
    }
  },
  getIcon(category) {
    return LIABILITY_CATEGORY_ICONS[category] || "bill-line-red.svg";
  },
  formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  parseNumber(val) {
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/,/g, "").trim();
      const num = Number(cleaned);
      return Number.isNaN(num) ? 0 : num;
    }
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
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
