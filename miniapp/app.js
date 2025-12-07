App({
  globalData: {
    apiBaseUrl: "",
    token: "",
    userId: null,
    userEmail: null,
    financeApi: { userId: "", userEmail: "", baseUrl: "https://acbim.cn" },
    // 请在这里配置实际的用户信息
    // 配置方法：
    // 1. testUserId: 数据库中实际用户的ID
    // 2. testUserEmail: 数据库中实际用户的邮箱
    // 例如：
    // testUserId: '123',
    // testUserEmail: 'user@example.com',
    testUserId: '1', // 请替换为实际的用户ID
    testUserEmail: 'test@example.com', // 请替换为实际的用户邮箱
    guest: false
  },
  _loginPromise: null,
  _lastLoginTs: 0,
  onLaunch() {
    this.setApiBaseUrl();
    try {
      const token = wx.getStorageSync('fw_token');
      if (token) {
        this.globalData.token = token;
      }
    } catch (e) {}
    try {
      const uid = wx.getStorageSync('fw_finance_api_user_id');
      const email = wx.getStorageSync('fw_finance_api_email');
      const base = wx.getStorageSync('fw_finance_api_base_url');
      if (uid) this.globalData.financeApi.userId = String(uid);
      if (email) this.globalData.financeApi.userEmail = String(email);
      if (base) this.globalData.financeApi.baseUrl = String(base);
    } catch (e) {}
    this.login().catch(() => {
      this.globalData.guest = true;
    });
  },
  setApiBaseUrl() {
    try {
      // 获取账号信息
      const accountInfo = wx.getAccountInfoSync();
      const envVersion = accountInfo.miniProgram.envVersion;
      
      // envVersion: 'develop' | 'trial' | 'release'
      // develop: 开发版
      // trial: 体验版
      // release: 正式版
      
      if (envVersion === 'release' || envVersion === 'trial') {
        this.globalData.apiBaseUrl = "https://finward.acbim.cn";
        console.log('[环境] 生产环境:', this.globalData.apiBaseUrl);
      } else {
        this.globalData.apiBaseUrl = "http://192.168.0.80:5085";
        console.log('[环境] 开发环境:', this.globalData.apiBaseUrl);
      }
    } catch (e) {
      this.globalData.apiBaseUrl = "https://finward.acbim.cn";
      console.log('[环境] 默认开发环境:', this.globalData.apiBaseUrl);
    }
  },
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: ({ code }) => {
          if (!code) {
            reject(new Error("no code"));
            return;
          }
          wx.request({
            url: `${this.globalData.apiBaseUrl}/auth/wechat`,
            method: "POST",
            data: { js_code: code },
            success: (res) => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const token = res.data?.token;
                if (token) {
                  this.globalData.token = token;
                  this.globalData.guest = false;
                  try { wx.setStorageSync('fw_token', token); } catch (e) {}
                  resolve(token);
                } else {
                  wx.showToast({ title: '登录失败：无令牌', icon: 'none' });
                  reject(new Error("no token"));
                }
              } else {
                const msg = res.data?.detail || '服务错误';
                wx.showToast({ title: `登录失败：${msg}`, icon: 'none' });
                reject(new Error(msg));
              }
            },
            fail: (err) => reject(err)
          });
        },
        fail: (err) => reject(err)
      });
    });
  },
  ensureLogin() {
    if (this.globalData.token) return Promise.resolve(this.globalData.token);
    if (this.globalData.guest) return Promise.reject(new Error('guest_mode'));
    if (this._loginPromise) return this._loginPromise;
    const now = Date.now();
    if (now - this._lastLoginTs < 1500 && this._loginPromise) return this._loginPromise;
    this._lastLoginTs = now;
    this._loginPromise = this.login().then((t) => {
      this.globalData.guest = false;
      return t;
    }).finally(() => {
      this._loginPromise = null;
    });
    return this._loginPromise;
  },
  logout() {
    try {
      wx.clearStorageSync();
    } catch (e) {}
    this.globalData.token = "";
    this.globalData.userInfo = null;
    this.globalData.userId = null;
    this.globalData.userEmail = null;
    this.globalData.guest = true;
  }
});
