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

Page({
  data: {
    loading: true,
    refreshing: false,
    needLogin: false,
    loggingIn: false,
    overview: {
      total_assets: "0.00",
      total_liabilities: "0.00",
      net_worth: "0.00"
    },
    assets: [],
    liabilities: [],
    chartData: []
  },
  openAssetDetail(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/asset-detail/index?id=${id}` });
  },
  openLiabilityDetail(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/liability-detail/index?id=${id}` });
  },
  onLoad() {
    const app = getApp();
    const token = app?.globalData?.token || wx.getStorageSync('fw_token');
    if (!token) {
      app.globalData.guest = true;
    } else if (!app.globalData.token) {
      app.globalData.token = token;
    }
    this.setData({ needLogin: false, loading: true });
    this.fetchData();
  },
  openItemActions(e) {
    const id = Number(e.currentTarget.dataset.id);
    const type = String(e.currentTarget.dataset.type || "");
    if (!id) return;
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: (res) => {
        if (res.tapIndex === 0) this.editItem(id, type);
        if (res.tapIndex === 1) this.deleteItem(id);
      }
    });
  },
  editItem(id, type) {
    const list = type === "asset" ? this.data.assets : this.data.liabilities;
    const item = list.find((x) => Number(x.id) === Number(id));
    if (!item) return;
    try {
      wx.setStorageSync("fw_edit_item", {
        id: item.id,
        name: item.name,
        type: type,
        category: item.category,
        amount: (typeof item.initial_amount === "string" ? Number(item.initial_amount.replace(/,/g, "")) : Number(item.initial_amount ?? item.amount)) || 0,
        note: item.note || "",
        loan_term_months: item.loan_term_months ?? null,
        monthly_payment: item.monthly_payment ?? null,
        investment_term_months: item.investment_term_months ?? null,
        monthly_income: item.monthly_income ?? null,
        invest_start_date: item.invest_start_date || "",
        depreciation_rate: item.depreciation_rate ?? null
      });
    } catch (e) {}
    wx.navigateTo({ url: `/pages/manage/index?edit=1&id=${id}` });
  },
  async deleteItem(id) {
    wx.showModal({
      title: "删除确认",
      content: "确定删除这条记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteAccount(id);
          wx.showToast({ title: "已删除", icon: "success" });
          this.fetchData(true);
        } catch (e) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  },
  onShow() {
    const app = getApp();
    const token = app?.globalData?.token || wx.getStorageSync('fw_token');
    if (!token) app.globalData.guest = true; else if (!app.globalData.token) app.globalData.token = token;
    this.setData({ needLogin: false, refreshing: true });
    this.fetchData(true);
  },
  async fetchData(quiet = false) {
    if (quiet) {
      this.setData({ refreshing: true });
    } else {
      this.setData({ loading: true });
    }
    try {
      const [overview, assets, liabilities] = await Promise.all([
        api.fetchOverview(),
        api.listAccounts("asset"),
        api.listAccounts("liability")
      ]);
      
      // 计算流动资金（现金、储蓄卡、活期、基金等）
      let liquidAssets = 0;
      const liquidCategories = ['现金', '储蓄卡', '活期', '基金'];
      assets.forEach(item => {
        if (liquidCategories.includes(item.category)) {
          liquidAssets += Number(item.current_value != null ? item.current_value : item.amount);
        }
      });
      
      // 格式化数据
      const formattedOverview = {
        total_assets: this.formatNumber(overview.total_assets),
        total_liabilities: this.formatNumber(overview.total_liabilities),
        net_worth: this.formatNumber(overview.net_worth),
        liquid_assets: this.formatNumber(liquidAssets) // 添加流动资金
      };

      let formattedAssets = assets.map(item => ({
        ...item,
        amount: this.formatNumber(item.current_value != null ? item.current_value : item.amount),
        updated_at: this.formatDate(item.updated_at),
        icon: getAssetCategoryIcon(item.category)
      }));
      let formattedLiabilities = liabilities.map(item => ({
        ...item,
        amount: this.formatNumber(item.current_value != null ? item.current_value : item.amount),
        updated_at: this.formatDate(item.updated_at),
        icon: getLiabilityCategoryIcon(item.category)
      }));

      try {
        const filter = wx.getStorageSync('dashboard_filter');
        if (filter && filter.category) {
          if (filter.type === 'asset') {
            formattedAssets = formattedAssets.filter(x => String(x.category) === String(filter.category));
          } else if (filter.type === 'liability') {
            formattedLiabilities = formattedLiabilities.filter(x => String(x.category) === String(filter.category));
          }
          wx.removeStorageSync('dashboard_filter');
        }
      } catch (e) {}

      // 计算资产分布（按分类，基于格式化后的类别更稳定）
      const chartData = this.calculateAssetDistribution(formattedAssets);
      const assetsPreview = formattedAssets.slice(0, 5);
      const liabilitiesPreview = formattedLiabilities.slice(0, 5);

      this.setData({
        overview: formattedOverview,
        assets: formattedAssets,
        assetsPreview,
        liabilities: formattedLiabilities,
        liabilitiesPreview,
        chartData,
        loading: false,
        refreshing: false
      }, () => {
        // 在数据设置完成后绘制图表
        setTimeout(() => {
          this.drawChart();
        }, 100);
      });
      } catch (error) {
      // 游客模式下不显示演示数据
      this.setData({
        overview: {
          total_assets: this.formatNumber(0),
          total_liabilities: this.formatNumber(0),
          net_worth: this.formatNumber(0),
          liquid_assets: this.formatNumber(0)
        },
        assets: [],
        assetsPreview: [],
        liabilities: [],
        liabilitiesPreview: [],
        chartData: [],
        loading: false,
        refreshing: false
      });
    }
  },
  formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      // 处理 ISO 格式日期字符串
      const date = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(date.getTime())) return "";
      
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return "今天";
      if (days === 1) return "昨天";
      if (days < 7) return `${days}天前`;
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    } catch (e) {
      return "";
    }
  },
  calculateAssetDistribution(assetList = []) {
    const toHalfWidth = (s) => String(s || "").replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    const baseLabels = ["现金","储蓄卡","活期","定期","基金","股票","理财","房产","车辆","应收款","其他"];
    const normalizeCat = (raw) => {
      const half = toHalfWidth(String(raw || "其他"));
      let s = half.replace(/\s+/g, " ").trim();
      s = s.replace(/其它/g, "其他");
      s = s.replace(/[()（）［］\[\]【】,，.;；:：\-—_/]/g, "");
      if (!s) return "其他";
      if (baseLabels.includes(s)) return s;
      const rules = [
        { re: /现金|cash/i, label: "现金" },
        { re: /储蓄卡|银行卡|借记卡|储蓄|存款|debit|saving|bank/i, label: "储蓄卡" },
        { re: /活期|current/i, label: "活期" },
        { re: /定期|存单|fixed|time/i, label: "定期" },
        { re: /基金|fund/i, label: "基金" },
        { re: /股票|证券|股|stock|equity/i, label: "股票" },
        { re: /理财|理财产品|wealth|financial/i, label: "理财" },
        { re: /房产|房屋|房地产|不动产|公寓|住宅|real\s*estate|property/i, label: "房产" },
        { re: /车辆|汽车|车|vehicle|car/i, label: "车辆" },
        { re: /应收款|应收|receivable/i, label: "应收款" }
      ];
      const hit = rules.find(r => r.re.test(s));
      return hit ? hit.label : "其他";
    };
    const cleanDisplay = (raw) => normalizeCat(raw);
    const extractCategory = (item) => {
      if (!item) return "其他";
      if (typeof item.category === "string" && item.category.trim()) return item.category;
      if (item.category && typeof item.category === "object") {
        return item.category.name || item.category.label || item.category.title || item.category.value || "其他";
      }
      if (typeof item.category_name === "string" && item.category_name.trim()) return item.category_name;
      if (typeof item.category_label === "string" && item.category_label.trim()) return item.category_label;
      if (typeof item.category_display === "string" && item.category_display.trim()) return item.category_display;
      return "其他";
    };
    const parseValue = (val) => {
      if (typeof val === "number" && !Number.isNaN(val)) return val;
      if (typeof val === "string") {
        const cleaned = val.replace(/,/g, "").trim();
        const num = Number(cleaned);
        return Number.isNaN(num) ? 0 : num;
      }
      const num = Number(val);
      return Number.isNaN(num) ? 0 : num;
    };
    const buckets = {};
    const display = {};
    (assetList || []).forEach((item) => {
      const raw = extractCategory(item) || "其他";
      const norm = normalizeCat(raw);
      const val = parseValue(item?.current_value ?? item?.amount ?? item?.initial_amount);
      if (val <= 0) return;
      buckets[norm] = (buckets[norm] || 0) + val;
      if (!(norm in display)) display[norm] = cleanDisplay(raw);
    });
    const entries = Object.keys(buckets).map((norm) => ({ norm, name: display[norm], value: buckets[norm] }));
    // 二次按显示名聚合，防止极端情况下出现重复名称拆分
    const nameBuckets = {};
    entries.forEach(e => { nameBuckets[e.name] = (nameBuckets[e.name] || 0) + e.value; });
    const merged = Object.keys(nameBuckets).map(name => ({ name, value: nameBuckets[name] }));
    merged.sort((a, b) => b.value - a.value);
    if (!merged.length) return [];
    const MAX_SEGMENTS = 6;
    let processed = merged.slice();
    if (merged.length > MAX_SEGMENTS) {
      const major = merged.slice(0, MAX_SEGMENTS - 1);
      const others = merged.slice(MAX_SEGMENTS - 1);
      const othersValue = others.reduce((sum, item) => sum + item.value, 0);
      processed = [...major, { name: "其他", value: othersValue }];
    }
    const total = processed.reduce((sum, item) => sum + item.value, 0);
    if (!total) return [];
    const palette = ["#43B176", "#DBA637", "#6FC298", "#95D3B4", "#BFE6D0", "#E3F5EC"];
    const COLOR_MAP = {
      "现金": "#22C55E",
      "储蓄卡": "#16A34A",
      "活期": "#10B981",
      "定期": "#059669",
      "基金": "#DBA637",
      "股票": "#F59E0B",
      "理财": "#34D399",
      "房产": "#4ADE80",
      "车辆": "#FB923C",
      "应收款": "#A78BFA",
      "其他": "#E5E7EB"
    };
    return processed.map((entry, idx) => ({
      name: entry.name,
      value: entry.value,
      percentage: ((entry.value / total) * 100).toFixed(1),
      color: COLOR_MAP[entry.name] || palette[idx % palette.length]
    }));
  },
  drawChart() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#pieChart').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const { node: canvas, width, height } = res[0];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let dpr = 1;
      if (typeof wx.getWindowInfo === "function") {
        dpr = wx.getWindowInfo().pixelRatio || 1;
      } else if (typeof wx.getSystemSetting === "function") {
        dpr = wx.getSystemSetting().pixelRatio || 1;
      }
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      const { chartData } = this.data;
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;
      if (!chartData || chartData.length === 0 || chartData.every(item => Number(item.value) <= 0)) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        return;
      }
      let currentAngle = -Math.PI / 2;
      chartData.forEach((item) => {
        const percentage = parseFloat(item.percentage) / 100;
        if (!percentage || percentage <= 0) return;
        const angle = percentage * 2 * Math.PI;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.closePath();
        ctx.fill();
        currentAngle += angle;
      });
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.45, 0, 2 * Math.PI);
      ctx.fill();
    });
  },
  async handleLogin() {
    const app = getApp();
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true });
    try {
      if (typeof app.ensureLogin === "function") {
        await app.ensureLogin();
      } else {
        await app.login();
      }
      this.setData({ needLogin: false, loggingIn: false, loading: true });
      this.fetchData();
    } catch (e) {
      this.setData({ loggingIn: false });
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },
  goToAnalytics() {
    wx.switchTab({
      url: "/pages/analytics/index"
    });
  },
  goToLiabilities() {
    wx.navigateTo({
      url: "/pages/liabilities/index"
    });
  },
  goToAssets() {
    wx.navigateTo({
      url: "/pages/assets/index"
    });
  },
  goToManage() {
    wx.navigateTo({
      url: "/pages/manage/index"
    });
  }
});
