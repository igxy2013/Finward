Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    authorizing: false,
    gettingWx: false,
    saving: false,
    profile: { nickname: "", avatar_url: "" },
    displayName: "",
    displayAvatar: "",
    editing: false,
    members: [],
    household: null,
    currentUserId: 0,
    inviting: false,
    invite: { code: "", expiresAt: "" },
    joining: false,
    joinCode: "",
    backfilling: false
  },
  onShow() {
    const app = getApp();
    this.setData({
      userInfo: app?.globalData?.userInfo || null,
      isLoggedIn: !!app?.globalData?.token
    });
    if (this.data.isLoggedIn) {
      this.loadProfile();
      this.refreshMembers();
    }
    this.computeDisplay();
  },
  computeDisplay() {
    const dn = (this.data.profile?.nickname) || (this.data.userInfo?.nickName) || (this.data.isLoggedIn ? '点击编辑' : '未登录');
    const da = (this.data.profile?.avatar_url) || (this.data.userInfo?.avatarUrl) || '';
    this.setData({ displayName: dn, displayAvatar: da });
  },
  async loadProfile() {
    try {
      const api = require("../../utils/api");
      const p = await api.getProfile();
      this.setData({ profile: { nickname: p.nickname || "", avatar_url: p.avatar_url || "" }, currentUserId: p.id || 0 });
      
      // 将用户ID和邮箱存储在全局数据中
      const app = getApp();
      if (app && p.id) {
        app.globalData.userId = p.id;
        console.log('用户ID已存储在全局数据中:', p.id);
      }
      if (app && p.email) {
        app.globalData.userEmail = p.email;
        console.log('用户邮箱已存储在全局数据中:', p.email);
      }
      
      this.computeDisplay();
    } catch (e) {}
  },
  async refreshMembers() {
    try {
      const api = require("../../utils/api");
      const hh = await api.getHousehold();
      const members = await api.listMembers();
      const mapped = (members || []).map((m) => {
        if (m.user_id === this.data.currentUserId) {
          return {
            ...m,
            nickname: m.nickname || this.data.displayName || '',
            avatar_url: m.avatar_url || this.data.displayAvatar || ''
          };
        }
        return m;
      });
      this.setData({ members: mapped, household: hh });
    } catch (e) {}
  },
  async handleRemoveMember(e) {
    const userId = e?.currentTarget?.dataset?.userId;
    if (!userId) return;
    try {
      const api = require("../../utils/api");
      await api.removeMember(userId);
      wx.showToast({ title: '已移除', icon: 'success' });
      this.refreshMembers();
    } catch (err) {
      wx.showToast({ title: '移除失败', icon: 'none' });
    }
  },
  async handleAuthorize() {
    const app = getApp();
    if (this.data.authorizing) return;
    this.setData({ authorizing: true });
    try {
      let profile = null;
      if (wx.getUserProfile) {
        profile = await new Promise((resolve, reject) => {
          wx.getUserProfile({
            desc: '用于完善个人资料',
            success: resolve,
            fail: reject
          });
        });
      }

      await app.login();

      if (profile?.userInfo) {
        app.globalData.userInfo = profile.userInfo;
        this.setData({ userInfo: profile.userInfo });
        try {
          const api = require("../../utils/api");
          await api.updateProfile({ nickname: profile.userInfo.nickName || "", avatar_url: profile.userInfo.avatarUrl || "" });
          this.loadProfile();
        } catch (e) {}
      }

      this.setData({ isLoggedIn: true });
      wx.showToast({ title: '登录成功', icon: 'success' });
      wx.switchTab({ url: '/pages/dashboard/index' });
    } catch (e) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ authorizing: false });
    }
  },
  async getWeChatProfile() {
    if (this.data.gettingWx) return;
    this.setData({ gettingWx: true });
    try {
      if (wx.getUserProfile) {
        const res = await new Promise((resolve, reject) => {
          wx.getUserProfile({ desc: '用于完善个人资料', success: resolve, fail: reject });
        });
        const ui = res?.userInfo || {};
        this.setData({ profile: { nickname: ui.nickName || "", avatar_url: ui.avatarUrl || this.data.profile.avatar_url } });
        this.computeDisplay();
      }
    } catch (e) {} finally {
      this.setData({ gettingWx: false });
    }
  },
  onNicknameInput(e) {
    this.setData({ 'profile.nickname': e.detail.value || '' });
    this.computeDisplay();
  },
  onAvatarUrlInput(e) {
    this.setData({ 'profile.avatar_url': e.detail.value || '' });
    this.computeDisplay();
  },
  onChooseAvatar(e) {
    const url = e?.detail?.avatarUrl || '';
    if (url) this.setData({ 'profile.avatar_url': url });
    this.computeDisplay();
  },
  async saveProfile() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const api = require("../../utils/api");
      await api.updateProfile(this.data.profile);
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editing: false });
      this.refreshMembers();
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
  toggleEdit() {
    this.setData({ editing: !this.data.editing });
  },
  handleLogout() {
    const app = getApp();
    app.logout();
    this.setData({
      userInfo: null,
      isLoggedIn: false,
      profile: { nickname: "", avatar_url: "" },
      members: [],
      editing: false
    });
    wx.showToast({ title: '已退出', icon: 'success' });
  },
  async handleCreateInvite() {
    if (this.data.inviting) return;
    this.setData({ inviting: true });
    try {
      const api = require("../../utils/api");
      const invite = await api.createInvitation();
      const expiresAt = new Date(invite.expires_at).toLocaleString();
      this.setData({ invite: { code: invite.code, expiresAt } });
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' });
    } finally {
      this.setData({ inviting: false });
    }
  },
  copyInvite() {
    wx.setClipboardData({ data: this.data.invite.code, success: () => wx.showToast({icon: 'success', title: '已复制'}) });
  },
  onJoinCodeInput(e) {
    this.setData({ joinCode: e.detail.value });
  },
  async handleJoin() {
    if (this.data.joining || !this.data.joinCode) return;
    this.setData({ joining: true });
    try {
      const api = require("../../utils/api");
      await api.joinHousehold(this.data.joinCode);
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.refreshMembers();
      this.setData({ joinCode: '' });
    } catch (e) {
      wx.showToast({ title: '加入失败', icon: 'none' });
    } finally {
      this.setData({ joining: false });
    }
  },
  async handleBackfill() {
    if (this.data.backfilling) return;
    this.setData({ backfilling: true });
    try {
      const api = require("../../utils/api");
      await api.backfill();
      wx.showToast({ title: '迁移成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '迁移失败', icon: 'none' });
    } finally {
      this.setData({ backfilling: false });
    }
  }
})
