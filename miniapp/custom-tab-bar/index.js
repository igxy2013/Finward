Component({
  data: {
    selected: 0,
    color: "#6B7280",
    selectedColor: "#43B176",
    list: [
      {
        pagePath: "pages/dashboard/index",
        text: "首页",
        iconPath: "/assets/icons/home-4-line.png",
        selectedIconPath: "/assets/icons/home-4-fill.png"
      },
      {
        pagePath: "pages/wealth/index",
        text: "收支",
        iconPath: "/assets/icons/wallet-2-line.png",
        selectedIconPath: "/assets/icons/wallet-2-fill.png"
      },
      {
        pagePath: "pages/analytics/index",
        text: "数据分析",
        iconPath: "/assets/icons/pie-chart-2-line.png",
        selectedIconPath: "/assets/icons/pie-chart-2-fill.png"
      },
      {
        pagePath: "pages/profile/index",
        text: "个人中心",
        iconPath: "/assets/icons/user-3-line.png",
        selectedIconPath: "/assets/icons/user-3-fill.png"
      }
    ]
  },
  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index || 0);
      const rawPath = String(e.currentTarget.dataset.path || "");
      if (!rawPath) return;
      const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      if (!path) return;
      if (index === this.data.selected) {
        wx.switchTab({ url: path });
        return;
      }
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    },
    onPlusTap() {
      wx.navigateTo({ url: "/pages/cashflow/index" });
    }
  }
});
