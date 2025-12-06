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
  "光伏发电站": "building-line.svg",
  "新能源充电站": "building-line.svg",
  "其他": "wallet-line.svg"
};

// 获取资产类别图标
const getAssetCategoryIcon = (category) => {
  return ASSET_CATEGORY_ICONS[category] || "wallet-3-line.svg";
};

Page({
  data: {
    assets: [],
    allAssets: [],
    filterCategory: "",
    categoryOptions: [
      { label: "全部", value: "" }
    ],
    activeCategoryIndex: 0
  },
  onLoad(options) {
    const fc = options && options.category ? decodeURIComponent(options.category) : "";
    this.setData({ filterCategory: fc });
  },
  onShow() {
    this.fetchAssets();
  },
  async fetchAssets() {
    try {
      const list = await api.listAccounts("asset");
      const formatted = (list || []).map(item => ({
        ...item,
        amount: this.formatNumber(item.current_value != null ? item.current_value : item.amount),
        updated_at: this.formatDate(item.updated_at),
        icon: getAssetCategoryIcon(item.category)
      }));
      this.updateCategoryOptionsAndData(formatted);
    } catch (e) {
      // 游客模式下不显示演示数据
      this.updateCategoryOptionsAndData([]);
    }
  },
  updateCategoryOptionsAndData(list) {
    const fc = this.data.filterCategory;
    const unique = Array.from(new Set((list || []).map(i => i.category).filter(Boolean)));
    const options = [
      { label: "全部", value: "" },
      ...unique.map(c => ({ label: c, value: c }))
    ];
    let activeCategoryIndex = 0;
    if (fc) {
      const matchedIndex = options.findIndex(opt => String(opt.value) === String(fc));
      if (matchedIndex >= 0) {
        activeCategoryIndex = matchedIndex;
      } else {
        options.push({ label: fc, value: fc });
        activeCategoryIndex = options.length - 1;
      }
    }
    this.setData({
      allAssets: list,
      categoryOptions: options,
      activeCategoryIndex
    }, () => this.applyCategoryFilter());
  },
  applyCategoryFilter() {
    const fc = this.data.filterCategory;
    const filtered = fc ? (this.data.allAssets || []).filter(i => String(i.category) === String(fc)) : (this.data.allAssets || []);
    this.setData({ assets: filtered });
  },
  handleCategoryTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index) || index === this.data.activeCategoryIndex) return;
    const selected = this.data.categoryOptions[index];
    this.setData({
      activeCategoryIndex: index,
      filterCategory: selected?.value || ""
    }, () => this.applyCategoryFilter());
  },
  openAssetDetail(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/asset-detail/index?id=${id}` });
  },
  openItemActions(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: (res) => {
        if (res.tapIndex === 0) this.editItem(id);
        if (res.tapIndex === 1) this.deleteItem(id);
      }
    });
  },
  editItem(id) {
    wx.navigateTo({ url: `/pages/manage/index?edit=1&id=${id}` });
  },
  async deleteItem(id) {
    const app = getApp();
    if (!app?.globalData?.token) {
      wx.showToast({ title: "请登录后操作", icon: "none" });
      return;
    }
    wx.showModal({
      title: "删除确认",
      content: "确定删除这条记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteAccount(id);
          wx.showToast({ title: "已删除", icon: "success" });
          this.fetchAssets();
        } catch (e) {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  },
  formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(String(dateStr).replace(' ', 'T'));
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
  }
});
