const api = require("../../utils/api");

const LIABILITY_CATEGORY_ICONS = {
  "信用卡": "bank-line-red.svg",
  "消费贷": "wallet-line-red.svg",
  "房贷": "home-4-line-red.svg",
  "车贷": "car-line-red.svg",
  "借款": "money-cny-circle-line-red.svg",
  "应付款": "bill-line-red.svg",
  "其他": "wallet-line-red.svg"
};

Page({
  data: {
    loading: true,
    error: "",
    id: null,
    detail: {},
    icon: "bill-line-red.svg",
    change_positive: false,
    change_negative: false,
    change_sign: "",
    showUpdateModal: false,
    updateValueInput: "",
    savingUpdate: false,
    valueUpdates: [],
    valueUpdatesRaw: [],
    editingUpdateId: null,
    editingUpdateTs: null,
    nKeyboardVisible: false,
    nKeyboardValue: '',
    nKeyboardTitle: '',
    nKeyboardMaxLength: 10,
    nKeyboardMaxDecimals: 2,
    nKeyboardTargetKey: ''
  },
  onLoad(options) {
    const id = Number(options?.id);
    if (!id) {
      this.setData({ loading: false, error: "参数错误" });
      return;
    }
    this.setData({ id, loading: true, error: "" });
    this.fetchDetail(id);
  },
  onShow() {
    const id = Number(this.data.id || 0);
    if (!id) return;
    this.fetchDetail(id);
    this.loadValueUpdates();
  },
  async fetchDetail(id) {
    try {
      const data = await api.getAccount(id);
      const icon = this.getIcon(data.category);
      const current = this.parseNumber(data.current_value ?? data.amount);
      const initial = this.parseNumber(data.initial_amount ?? data.amount);
      const change = current - initial;
      const change_positive = change > 0;
      const change_negative = change < 0;
      const change_sign = change > 0 ? "+￥" : (change < 0 ? "-￥" : "￥");
      const detail = {
        ...data,
        current_value_display: this.formatNumber(current),
        initial_amount_display: this.formatNumber(initial),
        change_display: this.formatNumber(Math.abs(change)),
        updated_at_display: this.formatDate(data.updated_at),
        created_at_display: this.formatDate(data.created_at),
        next_due_date_display: data.next_due_date ? this.formatDate(data.next_due_date) : "",
        monthly_payment_display: data.monthly_payment ? this.formatNumber(data.monthly_payment) : "",
        loan_start_date_display: data.loan_start_date ? this.formatDate(data.loan_start_date) : "",
        loan_end_date_display: (() => {
          const ed = data.loan_end_date;
          if (ed) return this.formatDate(ed);
          const sd = data.loan_start_date;
          const term = Number(data.loan_term_months || 0);
          if (!sd || !(term > 0)) return "";
          const s = new Date(String(sd).replace(/-/g, "/"));
          if (isNaN(s.getTime())) return "";
          const y = s.getFullYear();
          const m = s.getMonth();
          const d = s.getDate();
          const endMonthIdx = m + term - 1;
          const endDate = new Date(y, endMonthIdx + 1, 0);
          const day = Math.min(d, endDate.getDate());
          const finalDate = new Date(y, endMonthIdx, day);
          const yy = finalDate.getFullYear();
          const mm = String(finalDate.getMonth() + 1).padStart(2, '0');
          const dd = String(finalDate.getDate()).padStart(2, '0');
          return `${yy}-${mm}-${dd}`;
        })(),
        annual_interest_rate_display: (data.annual_interest_rate != null && data.annual_interest_rate !== "") ? Number(data.annual_interest_rate * 100).toFixed(2) : ""
      };
      this.setData({ detail, icon, change_positive, change_negative, change_sign, loading: false });
      this.loadValueUpdates();
    } catch (error) {
      this.setData({ loading: false, error: "加载失败" });
    }
  },
  loadValueUpdates() {
    const id = Number(this.data.id || 0);
    if (!id) return;
    (async () => {
      try {
        const arr = await api.listAccountValueUpdates(id);
        const formatted = (arr || []).map(r => ({
          id: r.id != null ? r.id : null,
          raw_ts: r.ts || r.created_at || null,
          value_raw: Number(r.value || 0),
          value_display: this.formatNumber(r.value),
          date_display: this.formatDateTime(r.ts || r.created_at)
        }));
        this.setData({ valueUpdates: formatted, valueUpdatesRaw: arr || [] }, () => {
          this.drawValueTrendChart();
        });
      } catch (e) {
        let arr = [];
        try { arr = wx.getStorageSync(`fw_value_updates:${id}`) || []; } catch (err) { arr = []; }
        const formatted = (arr || []).map(r => ({
          id: null,
          raw_ts: r.ts,
          value_raw: Number(r.value || 0),
          value_display: this.formatNumber(r.value),
          date_display: this.formatDateTime(new Date(r.ts))
        }));
        this.setData({ valueUpdates: formatted, valueUpdatesRaw: arr || [] }, () => {
          this.drawValueTrendChart();
        });
      }
    })();
  },
  drawValueTrendChart() {
    const list = this.data.valueUpdates || [];
    const detail = this.data.detail || {};
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#valueTrendCanvas').node()
      .select('#valueTrendCanvas').boundingClientRect()
      .exec((res) => {
        const node = res && res[0] ? res[0].node : null;
        const rect = res && res[1] ? res[1] : null;
        const fallbackW = 320;
        const fallbackH = 160;
        const width = rect && rect.width ? rect.width : fallbackW;
        const height = rect && rect.height ? rect.height : fallbackH;
        if (!node) return;
        const canvas = node;
        const ctx = canvas.getContext('2d');
        let dpr = 1;
        if (typeof wx.getWindowInfo === 'function') {
          const info = wx.getWindowInfo();
          dpr = (info && typeof info.pixelRatio === 'number') ? info.pixelRatio : 1;
        }
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.scale(dpr, dpr);
        const padding = 20;
        const iw = width - padding * 2;
        const ih = height - padding * 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        const parseTs = (x) => {
          try {
            const d = (x instanceof Date) ? x : new Date(String(x).replace(' ', 'T'));
            const t = d.getTime();
            return Number.isNaN(t) ? null : t;
          } catch (e) { return null; }
        };
        const startTs = (() => {
          const s = detail.loan_start_date || detail.created_at || null;
          const t = s ? parseTs(s) : null;
          return t != null ? t : Date.now();
        })();
        const initialVal = this.parseNumber(detail.initial_amount ?? detail.amount);
        const currentVal = this.parseNumber(detail.current_value ?? detail.initial_amount ?? detail.amount);
        const updates = list.slice().map(r => ({ ts: parseTs(r.raw_ts), val: Number(r.value_raw || 0) }))
          .filter(x => x.ts != null && x.ts >= startTs);
        const events = [{ ts: startTs, val: initialVal }, ...updates, { ts: Date.now(), val: currentVal }]
          .sort((a, b) => a.ts - b.ts)
          .reduce((acc, cur) => {
            if (!acc.length || acc[acc.length - 1].ts !== cur.ts) acc.push(cur); else acc[acc.length - 1] = cur;
            return acc;
          }, []);
        const values = events.map(x => Number(x.val || 0));
        const maxV = Math.max(...values);
        const minV = Math.min(...values);
        const range = (maxV - minV) || 1;
        const points = events.map((x, i) => {
          const v = Number(x.val || 0);
          const xPos = padding + (i / Math.max(events.length - 1, 1)) * iw;
          const yPos = padding + (1 - (v - minV) / range) * ih;
          return { x: xPos, y: yPos };
        });
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        const tickCount = 4;
        ctx.fillStyle = '#334155';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= tickCount; i++) {
          const y = padding + (i / tickCount) * ih;
          const v = minV + (1 - i / tickCount) * range;
          const label = this.formatNumber(v);
          ctx.fillText(label, padding+5, y);
        }
        const leftLabel = (() => {
          const s = events[0];
          const d = s && s.ts ? new Date(s.ts) : null;
          if (!d || isNaN(d.getTime())) return '';
          const yy = String(d.getFullYear());
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yy}/${mm}/${dd}`;
        })();
        const rightLabel = (() => {
          const s = events[events.length - 1];
          const d = s && s.ts ? new Date(s.ts) : null;
          if (!d || isNaN(d.getTime())) return '';
          const yy = String(d.getFullYear());
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yy}/${mm}/${dd}`;
        })();
        ctx.fillStyle = 'rgba(100,116,139,0.9)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = '10px sans-serif';
        ctx.fillText(leftLabel, padding, height - padding+16);
        ctx.textAlign = 'right';
        ctx.fillText(rightLabel, width - padding, height - padding+16);
        const updateEvents = events.slice(1, Math.max(events.length - 1, 1));
        if (updateEvents.length > 0) {
          const maxLabels = Math.max(2, Math.floor(iw / 70));
          const step = Math.max(1, Math.ceil(updateEvents.length / maxLabels));
          ctx.strokeStyle = 'rgba(51,65,85,0.3)';
          ctx.lineWidth = 1;
          ctx.fillStyle = 'rgba(100,116,139,0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.font = '10px sans-serif';
          for (let i = 0; i < updateEvents.length; i += step) {
            const idx = 1 + i;
            const px = points[idx].x;
            if (px < padding + 25 || px > width - padding - 25) continue;
            const d = new Date(updateEvents[i].ts);
            if (!d || isNaN(d.getTime())) continue;
            const yy = String(d.getFullYear());
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const label = `${yy}/${mm}/${dd}`;
            ctx.beginPath();
            ctx.moveTo(px, height - padding);
            ctx.lineTo(px, height - padding);
            ctx.stroke();
            ctx.fillText(label, px, height - padding+16);
          }
        }
        ctx.fillStyle = 'rgba(248,113,113,0.25)';
        ctx.beginPath();
        if (points.length === 1) {
          ctx.moveTo(points[0].x, height - padding);
          ctx.lineTo(points[0].x, points[0].y);
          ctx.lineTo(points[0].x, height - padding);
        } else if (points.length === 2) {
          ctx.moveTo(points[0].x, height - padding);
          ctx.lineTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.lineTo(points[1].x, height - padding);
        } else {
          ctx.moveTo(points[0].x, height - padding);
          ctx.lineTo(points[0].x, points[0].y);
          for (let i = 0; i < points.length - 1; i++) {
            const p0 = i > 0 ? points[i - 1] : points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = i < points.length - 2 ? points[i + 2] : p2;
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            const eps = 0.5;
            if (Math.abs(p2.y - p1.y) <= eps) {
              ctx.lineTo(p2.x, p2.y);
            } else {
              const s = 0.5;
              const cp1x = p1.x + (p2.x - p0.x) / 6 * s;
              let cp1y = p1.y + (p2.y - p0.y) / 6 * s;
              const cp2x = p2.x - (p3.x - p1.x) / 6 * s;
              let cp2y = p2.y - (p3.y - p1.y) / 6 * s;
              cp1y = Math.max(padding, Math.min(height - padding, Math.max(minY, Math.min(maxY, cp1y))));
              cp2y = Math.max(padding, Math.min(height - padding, Math.max(minY, Math.min(maxY, cp2y))));
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          }
          ctx.lineTo(points[points.length - 1].x, height - padding);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          if (points.length === 2) {
            ctx.lineTo(points[1].x, points[1].y);
          } else {
            for (let i = 0; i < points.length - 1; i++) {
              const p0 = i > 0 ? points[i - 1] : points[i];
              const p1 = points[i];
              const p2 = points[i + 1];
              const p3 = i < points.length - 2 ? points[i + 2] : p2;
              const minY = Math.min(p1.y, p2.y);
              const maxY = Math.max(p1.y, p2.y);
              const eps = 0.5;
              if (Math.abs(p2.y - p1.y) <= eps) {
                ctx.lineTo(p2.x, p2.y);
              } else {
                const s = 0.5;
                const cp1x = p1.x + (p2.x - p0.x) / 6 * s;
                let cp1y = p1.y + (p2.y - p0.y) / 6 * s;
                const cp2x = p2.x - (p3.x - p1.x) / 6 * s;
                let cp2y = p2.y - (p3.y - p1.y) / 6 * s;
                cp1y = Math.max(padding, Math.min(height - padding, Math.max(minY, Math.min(maxY, cp1y))));
                cp2y = Math.max(padding, Math.min(height - padding, Math.max(minY, Math.min(maxY, cp2y))));
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
              }
            }
          }
        }
        ctx.stroke();
        ctx.fillStyle = '#b91c1c';
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        if (events.length >= 2) {
          const startVal = this.formatNumber(events[0].val || 0);
          const endVal = this.formatNumber(events[events.length - 1].val || 0);
          ctx.fillStyle = '#64748b';
          ctx.textAlign = 'center';
          ctx.font = '10px sans-serif';
          ctx.fillText(`${startVal} → ${endVal}`, width / 2, padding - 6);
        }
      });
  },
  editValueUpdate(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    const ts = String(e.currentTarget.dataset.ts || "");
    const rec = (this.data.valueUpdates || []).find(x => (id ? String(x.id) === String(id) : String(x.raw_ts || '') === ts));
    if (!rec) return;
    const dateTime = rec.raw_ts ? new Date(rec.raw_ts) : new Date();
    const y = dateTime.getFullYear();
    const m = String(dateTime.getMonth() + 1).padStart(2, '0');
    const d = String(dateTime.getDate()).padStart(2, '0');
    const hh = String(dateTime.getHours()).padStart(2, '0');
    const mm = String(dateTime.getMinutes()).padStart(2, '0');
    this.setData({ showUpdateModal: true, updateValueInput: String(rec.value_raw || ''), updateDateInput: `${y}-${m}-${d}`, updateTimeInput: `${hh}:${mm}`, savingUpdate: false, editingUpdateId: id || null, editingUpdateTs: ts || null });
  },
  async deleteValueUpdate(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    const ts = String(e.currentTarget.dataset.ts || "");
    const accountId = Number(this.data.id || 0);
    if (!accountId) return;
    wx.showModal({
      title: "删除确认",
      content: "确定删除该更新记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        let ok = false;
        if (id) {
          try { await api.deleteAccountValueUpdate(accountId, id); ok = true; } catch (e) { ok = false; }
        }
        if (!ok) {
          try {
            let arr = wx.getStorageSync(`fw_value_updates:${accountId}`) || [];
            arr = (arr || []).filter(r => String(r.ts) !== ts);
            wx.setStorageSync(`fw_value_updates:${accountId}`, arr);
            ok = true;
          } catch (e) { ok = false; }
        }
        if (ok) {
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadValueUpdates();
        } else {
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      }
    });
  },
  openUpdateModal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    this.setData({ showUpdateModal: true, updateValueInput: "", updateDateInput: `${y}-${m}-${d}`, updateTimeInput: `${hh}:${mm}`, savingUpdate: false, editingUpdateId: null, editingUpdateTs: null });
  },
  closeUpdateModal() {
    this.setData({ showUpdateModal: false, savingUpdate: false });
  },
  handleUpdateInput(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateValueInput: v });
  },
  openNKeyboard(e) {
    const key = String(e.currentTarget.dataset.key || 'updateValueInput');
    const title = String(e.currentTarget.dataset.title || '输入');
    const current = String(this.data[key] || '');
    const maxDecimals = 2;
    const maxLength = 10;
    this.setData({
      nKeyboardVisible: true,
      nKeyboardValue: current,
      nKeyboardTitle: title,
      nKeyboardMaxLength: maxLength,
      nKeyboardMaxDecimals: maxDecimals,
      nKeyboardTargetKey: key
    });
  },
  onNKeyboardInput(e) {
    const v = String(e.detail.value || '');
    const key = this.data.nKeyboardTargetKey || 'updateValueInput';
    this.setData({ nKeyboardValue: v, [key]: v });
  },
  onNKeyboardConfirm(e) {
    this.setData({ nKeyboardVisible: false });
  },
  onNKeyboardSave(e) {
    const v = String(e.detail.value || '');
    const key = this.data.nKeyboardTargetKey || 'updateValueInput';
    this.setData({ [key]: v, nKeyboardVisible: false });
    if (typeof this.saveUpdateValue === 'function') this.saveUpdateValue();
  },
  onNKeyboardClose() {
    this.setData({ nKeyboardVisible: false });
  },
  handleUpdateDateChange(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateDateInput: v });
  },
  handleUpdateTimeChange(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateTimeInput: v });
  },
  async saveUpdateValue() {
    if (this.data.savingUpdate) return;
    const id = Number(this.data.id || 0);
    const vstr = String(this.data.updateValueInput || "").replace(/,/g, "");
    const val = Number(vstr);
    if (!id || Number.isNaN(val)) { wx.showToast({ title: "请输入有效金额", icon: "none" }); return; }
    this.setData({ savingUpdate: true });
    try {
      await api.updateAccount(id, { current_value: val });
      const updId = this.data.editingUpdateId;
      const dateStr = String(this.data.updateDateInput || "");
      const timeStr = String(this.data.updateTimeInput || "");
      let ts = Date.now();
      if (dateStr && timeStr) {
        const partsD = dateStr.split('-').map(x => Number(x));
        const partsT = timeStr.split(':').map(x => Number(x));
        const y = Number(partsD[0] || 0);
        const m = Number(partsD[1] || 1) - 1;
        const d = Number(partsD[2] || 1);
        const hh = Number(partsT[0] || 0);
        const mm = Number(partsT[1] || 0);
        const dtLocal = new Date(y, m, d, hh, mm);
        if (!isNaN(dtLocal.getTime())) ts = dtLocal.getTime();
      }
      if (updId) {
        try { await api.updateAccountValueUpdate(id, updId, val, ts); } catch (e2) {}
      } else {
        try { await api.createAccountValueUpdate(id, val, ts); } catch (e2) {}
      }
      let arr = [];
      try { arr = wx.getStorageSync(`fw_value_updates:${id}`) || []; } catch (e) { arr = []; }
      if (updId) {
        arr = (arr || []).map(r => ({ ...r, value: String(r.ts) === String(this.data.editingUpdateTs || '') ? val : r.value, ts: String(r.ts) === String(this.data.editingUpdateTs || '') ? ts : r.ts }));
      } else {
        arr.unshift({ value: val, ts });
      }
      try { wx.setStorageSync(`fw_value_updates:${id}`, arr); } catch (e) {}
      this.closeUpdateModal();
      wx.showToast({ title: "已更新", icon: "success" });
      this.fetchDetail(id);
      this.loadValueUpdates();
    } catch (e) {
      this.setData({ savingUpdate: false });
      wx.showToast({ title: "更新失败", icon: "none" });
    }
  },
  openEditMenu() {
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: (res) => {
        if (res.tapIndex === 0) this.editAccount();
        if (res.tapIndex === 1) this.deleteAccount();
      }
    });
  },
  editAccount() {
    const id = Number(this.data.id || this.data.detail?.id || 0);
    if (!id) return;
    wx.navigateTo({ url: `/pages/manage/index?edit=1&id=${id}` });
  },
  async deleteAccount() {
    const id = Number(this.data.id || this.data.detail?.id || 0);
    if (!id) return;
    wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，是否确认删除该负债？",
      confirmText: "删除",
      cancelText: "取消",
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteAccount(id);
            wx.showToast({ title: "已删除", icon: "success" });
            setTimeout(() => wx.navigateBack(), 400);
          } catch (e) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  },
  getIcon(category) {
    return LIABILITY_CATEGORY_ICONS[category] || "bill-line-red.svg";
  },
  formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  parseNumber(val) {
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/,/g, "").trim();
      const num = Number(cleaned);
      return Number.isNaN(num) ? 0 : num;
    }
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
  },
  formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(String(dateStr).replace(' ', 'T'));
      if (isNaN(date.getTime())) return "";
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch (e) {
      return "";
    }
  }
  ,formatDateTime(input) {
    if (!input) return "";
    try {
      const date = (input instanceof Date) ? input : new Date(String(input).replace(' ', 'T'));
      if (isNaN(date.getTime())) return "";
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}`;
    } catch (e) { return ""; }
  }
});
