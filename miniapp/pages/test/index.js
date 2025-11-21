Page({
  data: {
    token: '',
    authResult: null,
    financeStats: null
  },
  
  onShow() {
    const app = getApp();
    this.setData({
      token: app?.globalData?.token || '无token'
    });
    
    // 测试小程序内部认证
    this.testInternalAuth();
    
    // 测试外部API认证
    this.testExternalAPI();
  },
  
  async testInternalAuth() {
    try {
      const api = require("../../utils/api");
      const result = await api.testAuth();
      this.setData({ authResult: result });
      console.log('内部认证成功:', result);
    } catch (err) {
      console.log('内部认证失败:', err);
      this.setData({ authResult: { error: err } });
    }
  },
  
  async testExternalAPI() {
    try {
      const api = require("../../utils/api");
      const stats = await api.getFinanceStats('month');
      this.setData({ financeStats: stats });
      console.log('外部API调用成功:', stats);
    } catch (err) {
      console.log('外部API调用失败:', err);
      this.setData({ financeStats: { error: err } });
    }
  }
});