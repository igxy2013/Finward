const request = (path, options = {}) => {
  const app = getApp();
  const baseUrl = app?.globalData?.apiBaseUrl || "";
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "Content-Type": "application/json",
        ...(app?.globalData?.token ? { Authorization: `Bearer ${app.globalData.token}` } : {}),
        ...(options.header || {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401 && typeof app?.ensureLogin === "function") {
          if (app?.globalData?.guest) {
            // 游客模式下不触发登录重试，直接返回 401 以便前端使用演示数据
            reject(res.data);
            return;
          }
          app.ensureLogin()
            .then(() => {
              wx.request({
                url: `${baseUrl}${path}`,
                method: options.method || "GET",
                data: options.data || {},
                header: {
                  "Content-Type": "application/json",
                  ...(app?.globalData?.token ? { Authorization: `Bearer ${app.globalData.token}` } : {}),
                  ...(options.header || {})
                },
                success(retryRes) {
                  if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
                    resolve(retryRes.data);
                  } else {
                    reject(retryRes.data);
                  }
                },
                fail(err) {
                  reject(err);
                }
              });
            })
            .catch((err) => reject(err));
        } else {
          reject(res.data);
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
};

// 用于外部API请求的函数
const externalRequest = (url, options = {}) => {
  const app = getApp();
  return new Promise((resolve, reject) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.header || {})
    };
    
    // 如果有认证token，则添加到请求头中
    if (app?.globalData?.token) {
      headers.Authorization = `Bearer ${app.globalData.token}`;
      console.log('使用认证token访问外部API:', url);
    } else {
      console.log('无认证token访问外部API:', url);
    }
    
    // 处理查询参数
    let requestUrl = url;
    const params = { ...options.data };
    
    // 如果是财务统计API，添加user_id和token参数
    if (url.includes('/api/public/finance/stats')) {
      // 从环境变量或全局数据中获取用户ID和token
      const app = getApp();
      
      // 导入配置文件
      const config = require('../config.js');
      
      // 如果有用户ID，添加到参数中
      if (app?.globalData?.userId) {
        params.user_id = app.globalData.userId;
      }
      
      // 如果没有用户ID，使用配置文件中的用户ID
      if (!params.user_id) {
        params.user_id = config.financeApi.userId;
      }
      
      // 根据邮箱生成token
      if (app?.globalData?.userEmail) {
        // 根据后端代码，token格式为 finance_token_{user.email}
        params.token = `finance_token_${app.globalData.userEmail}`;
      } else if (!params.token) {
        // 如果没有token，使用配置文件中的用户邮箱生成token
        params.token = `finance_token_${config.financeApi.userEmail}`;
      }
      
      console.log('财务统计API参数:', params);
      console.log('请确保以下信息正确：');
      console.log('- user_id在数据库中存在');
      console.log('- 用户邮箱与token匹配');
      console.log('- token格式为: finance_token_{user_email}');
    }
    
    if (params) {
      const queryParams = [];
      for (const key in params) {
        if (params.hasOwnProperty(key)) {
          queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
      }
      if (queryParams.length > 0) {
        requestUrl += (url.includes('?') ? '&' : '?') + queryParams.join('&');
      }
    }
    
    wx.request({
      url: requestUrl,
      method: options.method || "GET",
      header: headers,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          console.log('外部API请求失败:', requestUrl, res.statusCode, res.data);
          reject(res.data);
        }
      },
      fail(error) {
        console.log('外部API请求网络错误:', requestUrl, error);
        reject(error);
      }
    });
  });
};

module.exports = {
  listAccounts: (type) => request(`/accounts`, { data: { type } }),
  createAccount: (data) => request(`/accounts`, { method: "POST", data }),
  updateAccount: (id, data) => request(`/accounts/${id}`, { method: "PATCH", data }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: "DELETE" }),
  fetchOverview: () => request(`/overview`),
  fetchAnalytics: (days = 30) => request(`/analytics`, { data: { days } }),
  fetchMonthlyAnalytics: (months = 12) => request(`/analytics/monthly`, { data: { months } }),
  getHousehold: () => request(`/households`),
  listMembers: () => request(`/households/members`),
  createInvitation: () => request(`/households/invitations`, { method: "POST" }),
  removeMember: (userId) => request(`/households/members/${userId}`, { method: "DELETE" }),
  joinHousehold: (code) => request(`/households/join`, { method: "POST", data: { code } })
  ,backfillHousehold: () => request(`/households/backfill`, { method: "POST" })
  ,fetchWealthSummary: (start, end, scope) => request(`/wealth/summary`, { data: { start, end, scope } })
  ,createCashflow: (data) => request(`/cashflows`, { method: "POST", data })
  ,listCashflows: (query) => request(`/cashflows`, { data: query || {} })
  ,getCashflow: (id) => request(`/cashflows/${id}`)
  ,updateCashflow: (id, data) => request(`/cashflows/${id}`, { method: "PUT", data })
  ,deleteCashflow: (id) => request(`/cashflows/${id}`, { method: "DELETE" })
  ,getAccount: (id) => request(`/accounts/${id}`)
  ,getProfile: () => request(`/auth/me`)
  ,updateProfile: (data) => request(`/auth/profile`, { method: "PATCH", data })
  ,listTenants: (account_id) => request(`/tenants`, { data: { account_id } })
  ,createTenant: (data) => request(`/tenants`, { method: "POST", data })
  ,updateTenant: (id, data) => request(`/tenants/${id}`, { method: "PATCH", data })
  ,deleteTenant: (id) => request(`/tenants/${id}`, { method: "DELETE" })
  ,listRentReminders: (days = 14) => request(`/tenants/rent/reminders`, { data: { days } })
  ,getFinanceStats: (timeRange, monthStr) => {
    const data = monthStr ? { time_range: timeRange, month: monthStr } : { time_range: timeRange };
    return externalRequest(`https://acbim.cn/api/public/finance/stats`, { data });
  }
  ,testAuth: () => request(`/auth/me`)
  ,saveMonthlySnapshot: (year, month, external_income) => {
    const data = { year, month };
    if (external_income != null) data.external_income = external_income;
    return request(`/analytics/snapshot`, { method: "POST", data });
  }
  ,getMonthlySnapshot: (year, month) => request(`/analytics/snapshot`, { data: { year, month } })
  ,fetchStats: (months = 12) => request(`/analytics/stats`, { data: { months } })
};
