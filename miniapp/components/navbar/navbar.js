const app = getApp();

Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true
  },
  externalClasses: ['custom-class'],
  properties: {
    title: {
      type: String,
      value: ''
    },
    backgroundColor: {
      type: String,
      value: '#43B176'
    },
    titleColor: {
      type: String,
      value: '#ffffff'
    },
    showBack: {
      type: Boolean,
      value: true // 默认显示，但在 attached 中会根据页面栈自动调整
    },
    placeholder: {
      type: Boolean,
      value: true
    }
  },
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navHeight: 64
  },
  lifetimes: {
    attached() {
      const win = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusBarHeight = win.statusBarHeight;
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      
      // 计算导航栏高度
      // 胶囊顶部 - 状态栏高度 = 胶囊与状态栏的间隙
      const gap = menuButtonInfo.top - statusBarHeight;
      // 导航栏内容高度 = 胶囊高度 + 2 * 间隙
      const navBarHeight = menuButtonInfo.height + (gap * 2);
      // 总高度 = 状态栏高度 + 导航栏内容高度
      const navHeight = statusBarHeight + navBarHeight;

      this.setData({
        statusBarHeight,
        navBarHeight,
        navHeight
      });
      
      // 自动判断是否显示返回按钮
      const pages = getCurrentPages();
      if (pages.length === 1) {
        // 页面栈只有1层，通常是首页或TabBar页，不显示返回按钮
        this.setData({ showBack: false });
      }
    }
  },
  methods: {
    onBack() {
      // 尝试返回上一页
      if (getCurrentPages().length > 1) {
        wx.navigateBack({
          delta: 1
        });
      }
      this.triggerEvent('back');
    }
  }
});
