const api = require("../../utils/api");

// 资产类别图标映射
const ASSET_CATEGORY_ICONS = {
  "现金": "wallet-3-line.svg",
  "储蓄卡": "bank-line.svg",
  "活期": "wallet-2-line.svg",
  "定期": "calendar-line.svg",
  "基金": "stock-line.svg",
  "股票": "line-chart-line.svg",
  "理财": "hand-coin-line.svg",
  "房产": "home-4-line.svg",
  "车辆": "car-line.svg",
  "应收款": "money-cny-circle-line.svg",
  "其他": "wallet-line.svg"
};

// 负债类别图标映射
const LIABILITY_CATEGORY_ICONS = {
  "信用卡": "bank-line-red.svg",
  "消费贷": "wallet-line-red.svg",
  "房贷": "home-4-line-red.svg",
  "车贷": "car-line-red.svg",
  "借款": "money-cny-circle-line-red.svg",
  "应付款": "bill-line-red.svg",
  "其他": "wallet-line-red.svg"
};

// 获取资产类别图标
const getAssetCategoryIcon = (category) => {
  return ASSET_CATEGORY_ICONS[category] || "wallet-3-line.svg";
};

// 获取负债类别图标
const getLiabilityCategoryIcon = (category) => {
  return LIABILITY_CATEGORY_ICONS[category] || "bill-line.svg";
};

const RANGE_OPTIONS = [
  { label: "本月", value: "month" },
  { label: "本年", value: "year" },
  { label: "全部", value: "all" }
];

Page({
  data: {
    loading: true,
    error: "",
    rangeLoading: false,
    needLogin: false,
    loggingIn: false,
    rangeOptions: RANGE_OPTIONS,
    activeRangeIndex: 0,
    summary: {
      netWorth: "0.00",
      totalAssets: "0.00",
      totalLiabilities: "0.00",
      netChange: "0.00",
      changeRatio: "0.00%",
      changeRatioValue: 0,
      debtRatio: "0.00%",
      debtRatioValue: 0
    },
    trend: [],
    assetCategories: [],
    liabilityCategories: [],
    cashflow: [],
    highlights: {
      bestCategory: "-",
      bestCategoryAmount: "0.00",
      riskCategory: "-",
      riskCategoryAmount: "0.00"
    }
  },
  openCategoryDetail(e) {
    const type = String(e.currentTarget.dataset.type || "");
    const category = String(e.currentTarget.dataset.category || "");
    const target = type === 'asset' ? '/pages/assets/index' : '/pages/liabilities/index';
    const url = `${target}?category=${encodeURIComponent(category)}`;
    wx.navigateTo({ url });
  },
  calcDays(value) {
    const now = new Date();
    if (value === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const days = Math.floor((now - first) / (1000 * 60 * 60 * 24)) + 1;
      return Math.min(365, Math.max(1, days));
    }
    if (value === "year") {
      const first = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - first) / (1000 * 60 * 60 * 24)) + 1;
      return Math.min(365, Math.max(1, days));
    }
    return 365;
  },
  onLoad() {
    const app = getApp();
    if (!app?.globalData?.token) {
      app.globalData.guest = true;
    }
    this.setData({ needLogin: false });
    this.fetchAnalytics();
  },
  onShow() {
    const app = getApp();
    if (!app?.globalData?.token) app.globalData.guest = true;
    if (this.data.needLogin) this.setData({ needLogin: false });
    this.fetchAnalytics(true);
  },
  handleRangeTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.activeRangeIndex) return;
    if (this.data.rangeLoading) return;
    this.setData({ activeRangeIndex: index }, () => {
      this.fetchAnalytics(true);
    });
  },
  async fetchAnalytics(quiet = false) {
    const rangeVal = this.data.rangeOptions[this.data.activeRangeIndex].value;
    const days = this.calcDays(rangeVal);
    if (quiet) {
      this.setData({ rangeLoading: true, error: "" });
    } else {
      this.setData({ loading: true, error: "" });
    }
    try {
      const res = await api.fetchAnalytics(days);
      const summary = this.formatSummary(res.summary || {});
      const assetCategories = this.prepareCategories(res.asset_categories || [], "asset");
      const liabilityCategories = this.prepareCategories(res.liability_categories || [], "liability");
      const highlights = this.formatHighlights(res.highlights || {});
      this.setData(
        {
          loading: false,
          rangeLoading: false,
          summary,
          trend: res.trend || [],
          assetCategories,
          liabilityCategories,
          cashflow: res.cashflow || [],
          highlights
        },
        () => {
          this.drawTrendChart();
          this.drawCashflowChart();
        }
      );
    } catch (error) {
      // 游客模式下不显示演示数据
      this.setData({
        loading: false,
        rangeLoading: false,
        summary: {
          netWorth: this.formatNumber(0),
          totalAssets: this.formatNumber(0),
          totalLiabilities: this.formatNumber(0),
          netChange: this.formatSignedNumber(0),
          changeRatio: "0%",
          changeRatioValue: 0,
          debtRatio: "0%",
          debtRatioValue: 0
        },
        trend: [],
        assetCategories: [],
        liabilityCategories: [],
        cashflow: [],
        highlights: {
          bestCategory: "-",
          bestCategoryAmount: "￥0.00",
          riskCategory: "-",
          riskCategoryAmount: "￥0.00"
        },
        error: ""
      });
    }
  },
  async handleLogin() {
    const app = getApp();
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true, error: "" });
    try {
      if (typeof app.ensureLogin === "function") {
        await app.ensureLogin();
      } else {
        await app.login();
      }
      this.setData({ needLogin: false, loggingIn: false });
      this.fetchAnalytics();
    } catch (e) {
      this.setData({ loggingIn: false, error: "登录失败，请重试" });
    }
  },
  formatSummary(summary) {
    const netWorth = this.formatNumber(summary.net_worth);
    const totalAssets = this.formatNumber(summary.total_assets);
    const totalLiabilities = this.formatNumber(summary.total_liabilities);
    const netChangeValue = Number(summary.net_change || 0);
    const changeRatioValue = Number(summary.change_ratio || 0);
    const debtRatioValue = Number(summary.debt_ratio || 0);
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      netChange: this.formatSignedNumber(netChangeValue),
      changeRatio: `${changeRatioValue >= 0 ? "+" : ""}${changeRatioValue.toFixed(2)}%`,
      changeRatioValue,
      debtRatio: `${debtRatioValue.toFixed(2)}%`,
      debtRatioValue
    };
  },
  prepareCategories(list, type) {
    return (list || []).map((item) => ({
      ...item,
      amountText: `￥${this.formatNumber(item.amount)}`,
      percentageText: `${Number(item.percentage || 0).toFixed(2)}%`,
      barClass: type === "asset" ? "asset-bar" : "liability-bar",
      icon: type === "asset" ? getAssetCategoryIcon(item.category) : getLiabilityCategoryIcon(item.category)
    }));
  },
  formatHighlights(highlights) {
    return {
      bestCategory: highlights.best_category || "-",
      bestCategoryAmount: `￥${this.formatNumber(highlights.best_category_amount)}`,
      riskCategory: highlights.risk_category || "-",
      riskCategoryAmount: `￥${this.formatNumber(highlights.risk_category_amount)}`
    };
  },
  drawTrendChart() {
    const trend = this.data.trend;
    const ctx = wx.createCanvasContext("trendChart", this);
    const query = wx.createSelectorQuery().in(this);
    query.select("#trendCanvas").boundingClientRect((rect) => {
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const innerWidth = width - padding * 2;
      const innerHeight = height - padding * 2;

      ctx.setFillStyle("rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, width, height);

      if (!trend || trend.length === 0) {
        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(14);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText("暂无趋势数据", width / 2, height / 2);
        ctx.draw();
        return;
      }

      const values = trend.map((item) => Number(item.net_worth || 0));
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const range = maxValue - minValue || 1;

      const points = trend.map((item, index) => {
        const value = Number(item.net_worth || 0);
        const x = padding + (index / Math.max(trend.length - 1, 1)) * innerWidth;
        const y = padding + (1 - (value - minValue) / range) * innerHeight;
        return { x, y };
      });

      // Axis
      ctx.setStrokeStyle("rgba(255,255,255,0.15)");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();

      // Area fill
      ctx.setFillStyle("rgba(99,102,241,0.25)");
      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding);
      points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.setStrokeStyle("#818cf8");
      ctx.setLineWidth(3);
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();

      // Dots
      ctx.setFillStyle("#c7d2fe");
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.draw();
    }).exec();
  },
  drawCashflowChart() {
    const cashflow = this.data.cashflow;
    const ctx = wx.createCanvasContext("cashflowChart", this);
    const query = wx.createSelectorQuery().in(this);
    query.select("#cashflowCanvas").boundingClientRect((rect) => {
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const chartHeight = height - padding * 2;
      const axisY = padding + chartHeight / 2;
      const barWidth = Math.max(12, (width - padding * 2) / Math.max(cashflow.length, 1) - 10);

      ctx.setFillStyle("rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, width, height);

      if (!cashflow || cashflow.length === 0) {
        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(14);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText("暂无现金流数据", width / 2, height / 2);
        ctx.draw();
        return;
      }

      const maxValue = Math.max(
        ...cashflow.map((item) => Math.max(Number(item.inflow || 0), Number(item.outflow || 0)))
      ) || 1;
      const scale = (chartHeight / 2) / maxValue;

      // Axis line
      ctx.setStrokeStyle("rgba(255,255,255,0.2)");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding, axisY);
      ctx.lineTo(width - padding, axisY);
      ctx.stroke();

      cashflow.forEach((item, index) => {
        const inflow = Number(item.inflow || 0);
        const outflow = Number(item.outflow || 0);
        const x = padding + index * (barWidth + 10) + barWidth / 2;

        const inflowHeight = inflow * scale;
        const outflowHeight = outflow * scale;

        ctx.setFillStyle("#22c55e");
        ctx.fillRect(
          x - barWidth / 2,
          axisY - inflowHeight,
          barWidth / 2 - 2,
          inflowHeight
        );

        ctx.setFillStyle("#ef4444");
        ctx.fillRect(
          x + 2,
          axisY,
          barWidth / 2 - 2,
          outflowHeight
        );

        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(12);
        ctx.setTextAlign("center");
        ctx.fillText(this.getDateLabel(item.date), x, height - 8);
      });

      ctx.draw();
    }).exec();
  },
  getDateLabel(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    return `${parts[1]}/${parts[2]}`;
  },
  formatNumber(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return "0.00";
    return num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },
  formatSignedNumber(value) {
    const num = Number(value || 0);
    const formatted = this.formatNumber(num);
    if (num > 0) return `+${formatted}`;
    if (num < 0) return `-${this.formatNumber(Math.abs(num))}`;
    return formatted;
  },
  onPullDownRefresh() {
    this.fetchAnalytics().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
