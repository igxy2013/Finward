Page({
  data: {
    activeAccountType: 'asset',
    activeFlowType: 'income',
    accountCategories: [],
    flowCategories: [],
    newAccountCategory: '',
    newFlowCategory: ''
  },
  onShow() {
    const ac = (() => { try { return wx.getStorageSync('fw_asset_categories'); } catch (e) { return null; } })();
    const lc = (() => { try { return wx.getStorageSync('fw_liability_categories'); } catch (e) { return null; } })();
    const ic = (() => { try { return wx.getStorageSync('fw_income_categories'); } catch (e) { return null; } })();
    const ec = (() => { try { return wx.getStorageSync('fw_expense_categories'); } catch (e) { return null; } })();
    const defAsset = ["现金","储蓄卡","活期","定期","基金","股票","理财","房产","车辆","应收款","对外投资","其他"];
    const defLiab = ["信用卡","消费贷","房贷","车贷","借款","应付款","其他"];
    const defIncome = ["租金收入","工资","兼职","奖金","理财收益","分红","投资回款","其他收入"];
    const defExpense = ["餐饮","交通出行","房租","物业管理","水电网","通讯","教育培训","医疗健康","保险","娱乐休闲","服饰美妆","日用品","借款还款","其他支出"];
    this._assetCats = Array.isArray(ac) && ac.length ? ac : defAsset;
    this._liabCats = Array.isArray(lc) && lc.length ? lc : defLiab;
    this._incomeCats = Array.isArray(ic) && ic.length ? ic : defIncome;
    this._expenseCats = Array.isArray(ec) && ec.length ? ec : defExpense;
    const list = this.data.activeAccountType === 'asset' ? this._assetCats : this._liabCats;
    const flow = this.data.activeFlowType === 'income' ? this._incomeCats : this._expenseCats;
    this.setData({ accountCategories: list, flowCategories: flow });
  },
  switchAccountType(e) {
    const v = String(e.currentTarget.dataset.value || 'asset');
    const list = v === 'asset' ? this._assetCats : this._liabCats;
    this.setData({ activeAccountType: v, accountCategories: list });
  },
  switchFlowType(e) {
    const v = String(e.currentTarget.dataset.value || 'income');
    const list = v === 'income' ? this._incomeCats : this._expenseCats;
    this.setData({ activeFlowType: v, flowCategories: list });
  },
  onNewAccountCategory(e) { this.setData({ newAccountCategory: String(e.detail.value || '').trim() }); },
  onNewFlowCategory(e) { this.setData({ newFlowCategory: String(e.detail.value || '').trim() }); },
  addAccountCategory() {
    const name = (this.data.newAccountCategory || '').trim();
    if (!name) return;
    const arr = this.data.activeAccountType === 'asset' ? this._assetCats : this._liabCats;
    if (!arr.includes(name)) arr.push(name);
    if (this.data.activeAccountType === 'asset') { this._assetCats = arr; try { wx.setStorageSync('fw_asset_categories', arr); } catch (e) {} }
    else { this._liabCats = arr; try { wx.setStorageSync('fw_liability_categories', arr); } catch (e) {} }
    this.setData({ accountCategories: arr.slice(), newAccountCategory: '' });
  },
  addFlowCategory() {
    const name = (this.data.newFlowCategory || '').trim();
    if (!name) return;
    const arr = this.data.activeFlowType === 'income' ? this._incomeCats : this._expenseCats;
    if (!arr.includes(name)) arr.push(name);
    if (this.data.activeFlowType === 'income') { this._incomeCats = arr; try { wx.setStorageSync('fw_income_categories', arr); } catch (e) {} }
    else { this._expenseCats = arr; try { wx.setStorageSync('fw_expense_categories', arr); } catch (e) {} }
    this.setData({ flowCategories: arr.slice(), newFlowCategory: '' });
  },
  removeAccountCategory(e) {
    const name = String(e.currentTarget.dataset.name || '');
    if (!name) return;
    const arr = this.data.activeAccountType === 'asset' ? this._assetCats : this._liabCats;
    const filtered = arr.filter(x => x !== name);
    if (this.data.activeAccountType === 'asset') { this._assetCats = filtered; try { wx.setStorageSync('fw_asset_categories', filtered); } catch (e) {} }
    else { this._liabCats = filtered; try { wx.setStorageSync('fw_liability_categories', filtered); } catch (e) {} }
    this.setData({ accountCategories: filtered.slice() });
  },
  removeFlowCategory(e) {
    const name = String(e.currentTarget.dataset.name || '');
    if (!name) return;
    const arr = this.data.activeFlowType === 'income' ? this._incomeCats : this._expenseCats;
    const filtered = arr.filter(x => x !== name);
    if (this.data.activeFlowType === 'income') { this._incomeCats = filtered; try { wx.setStorageSync('fw_income_categories', filtered); } catch (e) {} }
    else { this._expenseCats = filtered; try { wx.setStorageSync('fw_expense_categories', filtered); } catch (e) {} }
    this.setData({ flowCategories: filtered.slice() });
  }
});
