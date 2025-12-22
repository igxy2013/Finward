const api = require("../../utils/api");

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
  "对外投资": "building-line.svg",
  "其他": "wallet-line.svg"
};

Page({
  data: {
    loading: true,
    error: "",
    id: null,
    detail: {},
    icon: "wallet-3-line.svg",
    tenants: [],
    rentRecords: [],
    change_positive: false,
    change_negative: false,
    change_sign: "",
    showUpdateModal: false,
    updateValueInput: "",
    updateDateInput: "",
    updateTimeInput: "",
    updateNoteInput: "",
    savingUpdate: false,
    valueUpdates: [],
    valueUpdatesRaw: [],
    editingUpdateId: null,
    editingUpdateTs: null,
    isDepreciating: false,
    nKeyboardVisible: false,
    nKeyboardValue: '',
    nKeyboardTitle: '',
    nKeyboardMaxLength: 10,
    nKeyboardMaxDecimals: 2,
    nKeyboardTargetKey: ''
  },
  collectRent() {
    const { tenants = [], detail = {} } = this.data;
    if (!tenants.length) {
      wx.showToast({ title: "无租客信息", icon: "none" });
      return;
    }
    const go = (t) => {
      const amt = Number(t?.monthly_rent || 0);
      const date = this.today();
      const note = `${detail.name || ''} - ${t?.tenant_name || ''}`.trim();
      const url = `/pages/cashflow/index?preset=rent&type=income&category=${encodeURIComponent('租金收入')}&amount=${encodeURIComponent(String(amt))}&date=${encodeURIComponent(date)}&note=${encodeURIComponent(note)}&account_id=${encodeURIComponent(String(detail.id || ''))}&tenancy_id=${encodeURIComponent(String(t?.id || ''))}&account_name=${encodeURIComponent(String(detail.name || ''))}&tenant_name=${encodeURIComponent(String(t?.tenant_name || ''))}`;
      wx.navigateTo({ url });
    };
    if (tenants.length === 1) {
      go(tenants[0]);
      return;
    }
    wx.showActionSheet({
      itemList: tenants.map(x => `${x.tenant_name} ￥${this.formatNumber(x.monthly_rent)}`),
      success: (res) => {
        const idx = res.tapIndex;
        if (idx >= 0 && idx < tenants.length) go(tenants[idx]);
      }
    });
  },
  today() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
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
      content: "删除后不可恢复，是否确认删除该资产？",
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
        monthly_income_display: data.monthly_income ? this.formatNumber(data.monthly_income) : "",
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
          return this.formatDate(`${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, '0')}-${String(finalDate.getDate()).padStart(2, '0')}`);
        })(),
        invest_start_date_display: data.invest_start_date ? this.formatDate(data.invest_start_date) : "",
        invest_end_date_display: (() => {
          const ed = data.invest_end_date;
          if (ed) return this.formatDate(ed);
          const sd = data.invest_start_date;
          // 房产类资产忽略投资期限
          const term = (data.category === '房产') ? 0 : Number(data.investment_term_months || 0);
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
          return this.formatDate(`${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, '0')}-${String(finalDate.getDate()).padStart(2, '0')}`);
        })(),
        depreciation_rate_display: (data.depreciation_rate != null && data.depreciation_rate !== "") ? Number(data.depreciation_rate * 100).toFixed(2) : ""
      };
      this.setData({
        detail,
        icon,
        change_positive,
        change_negative,
        change_sign,
        loading: false
      });
      await this.loadTenants(id);
      await this.fetchRentRecords();
      this.autoDepreciationUpdateIfNeeded();
      this.loadValueUpdates();
    } catch (error) {
      this.setData({ loading: false, error: "加载失败" });
    }
  },
  async loadTenants(id) {
    try {
      const tenants = await api.listTenants(id);
      const formatted = (tenants || []).map(t => ({
        ...t,
        monthly_rent_display: this.formatNumber(t.monthly_rent),
        next_due_date_display: t.next_due_date ? this.formatDate(t.next_due_date) : "",
        frequency_label: this.mapFrequency(t.frequency || 'monthly'),
        due_day_display: t.due_day ? `每期${String(t.due_day)}日` : "",
        start_date_display: t.start_date ? this.formatDate(t.start_date) : "",
        end_date_display: t.end_date ? this.formatDate(t.end_date) : "",
        reminder_display: t.reminder_enabled ? "已开启" : "已关闭"
      }));
      this.setData({ tenants: formatted });
    } catch (e) {
      // 保持原样，不打断页面渲染
    }
  },
  goRentDetail() {
    const id = Number(this.data.id || this.data.detail?.id || 0);
    if (!id) return;
    wx.navigateTo({ url: `/pages/rent-detail/index?id=${id}` });
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
          date_display: this.formatDateTime(r.ts || r.created_at),
          note: r.note || ''
        }));
        this.setData({ valueUpdates: formatted, valueUpdatesRaw: arr || [] }, () => {
          const latest = (formatted || []).sort((a, b) => {
            const ta = a.raw_ts ? new Date(a.raw_ts).getTime() : 0;
            const tb = b.raw_ts ? new Date(b.raw_ts).getTime() : 0;
            return tb - ta;
          })[0];
          if (latest && typeof latest.value_raw === 'number') {
            const initial = this.parseNumber(this.data.detail?.initial_amount ?? this.data.detail?.amount);
            const current = Number(latest.value_raw || 0);
            const change = current - initial;
            const change_positive = change > 0;
            const change_negative = change < 0;
            const change_sign = change > 0 ? "+￥" : (change < 0 ? "-￥" : "￥");
            this.setData({
              detail: { ...this.data.detail, current_value: current, current_value_display: this.formatNumber(current), change_display: this.formatNumber(Math.abs(change)) },
              change_positive,
              change_negative,
              change_sign
            });
          }
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
          date_display: this.formatDateTime(new Date(r.ts)),
          note: r.note || ''
        }));
        this.setData({ valueUpdates: formatted, valueUpdatesRaw: arr || [] }, () => {
          const latest = (formatted || [])[0];
          if (latest && typeof latest.value_raw === 'number') {
            const initial = this.parseNumber(this.data.detail?.initial_amount ?? this.data.detail?.amount);
            const current = Number(latest.value_raw || 0);
            const change = current - initial;
            const change_positive = change > 0;
            const change_negative = change < 0;
            const change_sign = change > 0 ? "+￥" : (change < 0 ? "-￥" : "￥");
            this.setData({
              detail: { ...this.data.detail, current_value: current, current_value_display: this.formatNumber(current), change_display: this.formatNumber(Math.abs(change)) },
              change_positive,
              change_negative,
              change_sign
            });
          }
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
          const s = detail.invest_start_date || detail.created_at || null;
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
        ctx.fillStyle = 'rgba(129,140,248,0.25)';
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
        ctx.strokeStyle = '#3b82f6';
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
        ctx.fillStyle = '#1d4ed8';
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
  autoDepreciationUpdateIfNeeded() {
    if (this.data.isDepreciating) return;
    const detail = this.data.detail || {};
    const rate = Number(detail.depreciation_rate || 0);
    const base = this.parseNumber(detail.initial_amount ?? detail.amount);
    const startStr = detail.invest_start_date || null;
    if (!(rate > 0) || !startStr || !(base > 0)) return;
    const endStr = detail.invest_end_date || null;
    const start = new Date(String(startStr).replace(/-/g, "/"));
    if (isNaN(start.getTime())) return;
    const now = new Date();
    if (endStr) {
      const end = new Date(String(endStr).replace(/-/g, "/"));
      if (!isNaN(end.getTime()) && now > end) return;
    }
    const clampDay = (y, m, d) => {
      const end = new Date(y, m + 1, 0);
      const day = Math.min(d, end.getDate());
      return new Date(y, m, day);
    };
    const anniv = clampDay(now.getFullYear(), start.getMonth(), start.getDate());
    const isAnniversaryToday = anniv.getFullYear() === now.getFullYear()
      && anniv.getMonth() === now.getMonth()
      && anniv.getDate() === now.getDate();
    if (!isAnniversaryToday) return;
    const todayY = now.getFullYear();
    const todayM = String(now.getMonth() + 1).padStart(2, '0');
    const todayD = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayY}-${todayM}-${todayD}`;
    const createdTodayAuto = (this.data.valueUpdatesRaw || []).some(r => {
      const s = r.created_at || r.ts;
      const d = s ? new Date(String(s).replace(' ', 'T')) : null;
      if (!d || isNaN(d.getTime())) return false;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ds = `${y}-${m}-${dd}`;
      return ds === todayStr && String(r.note || '') === '折旧自动更新';
    });
    if (createdTodayAuto) return;
    const yearsElapsed = now.getFullYear() - start.getFullYear();
    if (!(yearsElapsed >= 1)) return;
    const id = Number(this.data.id || 0);
    if (!id) return;
    const lifeYears = (() => {
      const termMonths = Number(detail.investment_term_months || 0);
      if (termMonths > 0) return Math.max(1, Math.floor(termMonths / 12));
      if (rate > 0) return Math.max(1, Math.round(1 / rate));
      return Math.max(1, yearsElapsed);
    })();
    const method = String(detail.depreciation_method || '').toLowerCase();
    const computeValue = (m, base0, years, life) => {
      const salvage = 0;
      if (m === 'syd') {
        const n = Math.max(1, life);
        const sumYears = n * (n + 1) / 2;
        let dep = 0;
        for (let k = 1; k <= Math.min(years, n); k++) {
          const remaining = n - (k - 1);
          dep += (remaining / sumYears) * (base0 - salvage);
        }
        return Math.max(salvage, base0 - dep);
      }
      // 默认双倍余额递减法（DDB）
      const n = Math.max(1, life);
      const ddbRate = 2 / n;
      let value = base0;
      for (let k = 1; k <= Math.min(years, n); k++) {
        value = value * (1 - ddbRate);
        if (value < salvage) { value = salvage; break; }
      }
      return Math.max(salvage, value);
    };
    const newValue = computeValue(method || 'ddb', base, yearsElapsed, lifeYears);
    this.setData({ isDepreciating: true });
    (async () => {
      try {
        try { await api.createAccountValueUpdate(id, Number(newValue.toFixed(2)), anniv.getTime(), '折旧自动更新'); } catch (e) {}
        this.loadValueUpdates();
      } finally {
        this.setData({ isDepreciating: false });
      }
    })();
  }
  ,openUpdateModal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    this.setData({ showUpdateModal: true, updateValueInput: "", updateDateInput: `${y}-${m}-${d}`, updateTimeInput: `${hh}:${mm}`, updateNoteInput: "", savingUpdate: false, editingUpdateId: null, editingUpdateTs: null });
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
  handleUpdateNoteInput(e) {
    const v = String(e.detail.value || "");
    this.setData({ updateNoteInput: v });
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
      const note = String(this.data.updateNoteInput || "");
      if (updId) {
        try { await api.updateAccountValueUpdate(id, updId, val, ts, note); } catch (e2) {}
      } else {
        try { await api.createAccountValueUpdate(id, val, ts, note); } catch (e2) {}
      }
      let arr = [];
      try { arr = wx.getStorageSync(`fw_value_updates:${id}`) || []; } catch (e) { arr = []; }
      if (updId) {
        arr = (arr || []).map(r => ({ ...r, value: String(r.ts) === String(this.data.editingUpdateTs || '') ? val : r.value, ts: String(r.ts) === String(this.data.editingUpdateTs || '') ? ts : r.ts, note: String(r.ts) === String(this.data.editingUpdateTs || '') ? note : r.note }));
      } else {
        arr.unshift({ value: val, ts, note });
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
  mapFrequency(f) {
    const m = { monthly: "按月", quarterly: "按季", semiannual: "半年", annual: "按年" };
    return m[f] || "按月";
  },
  async fetchRentRecords() {
    try {
      const { detail, tenants = [] } = this.data;
      const list = await api.listCashflows({ type: 'income' });
      const assetName = String(detail?.name || "");
      const isIncome = (x) => String(x.type || '') === 'income';
      const isRentCategory = (x) => String(x.category || '') === '租金收入';
      const base = (list || []).filter(isIncome).filter(isRentCategory);
      const strictByFields = base.filter(x => (Number(x.account_id || 0) === Number(detail.id)) || (x.account_name && String(x.account_name) === assetName));
      let chosen = strictByFields;
      if (!chosen.length) {
        const aMarker = detail?.id ? `[asset:${detail.id}]` : '';
        const tMarkers = (tenants || []).map(t => t?.id ? `[tenant:${t.id}]` : '').filter(Boolean);
        const tNames = (tenants || []).map(t => String(t.tenant_name || '')).filter(Boolean);
        const noteOf = (x) => String(x.note || '');
        chosen = base.filter(x => {
          const note = noteOf(x);
          if (aMarker && note.includes(aMarker)) return true;
          if (assetName && note.includes(`${assetName} -`)) return true;
          if (tMarkers.length && tMarkers.some(m => note.includes(m))) return true;
          if (tNames.length && tNames.some(n => n && note.includes(n))) return true;
          return false;
        });
      }
      const records = chosen.map(x => ({
        id: x.id,
        amount_display: this.formatNumber(x.amount),
        date_display: this.formatDate(x.date),
        raw_date: x.date,
        note: x.note || '',
        account_id: x.account_id || null,
        tenancy_id: x.tenancy_id || null,
        account_name: x.account_name || ''
      }));
      this.setData({ rentRecords: records }, () => {
        this.recomputeNextDueForTenants();
      });
    } catch (e) {}
  },
  recomputeNextDueForTenants() {
    const { tenants = [], rentRecords = [] } = this.data;
    if (!tenants.length) return;
    const freqMonths = (f) => {
      if (f === 'quarterly') return 3;
      if (f === 'semiannual') return 6;
      if (f === 'annual') return 12;
      return 1;
    };
    const addMonths = (dateStr, months) => {
      try {
        const d = new Date(String(dateStr).replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = d.getMonth();
        const dd = d.getDate();
        const targetM = m + months;
        const y2 = y + Math.floor(targetM / 12);
        const m2 = ((targetM % 12) + 12) % 12;
        const daysInMonth = (ym) => {
          const [yy, mm] = ym;
          return new Date(yy, mm + 1, 0).getDate();
        };
        const maxDay = daysInMonth([y2, m2]);
        const d2 = Math.min(dd, maxDay);
        const res = new Date(y2, m2, d2);
        const yS = res.getFullYear();
        const mS = String(res.getMonth() + 1).padStart(2, '0');
        const dS = String(res.getDate()).padStart(2, '0');
        return `${yS}-${mS}-${dS}`;
      } catch (e) {
        return '';
      }
    };
    const updated = tenants.map(t => {
      const last = rentRecords
        .filter(r => Number(r.tenancy_id || 0) === Number(t.id))
        .map(r => r.raw_date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];
      if (last) {
        const next = addMonths(last, freqMonths(t.frequency || 'monthly'));
        return { ...t, next_due_date_display: next };
      }
      return t;
    });
    this.setData({ tenants: updated });
  },
  copyContractUrl(e) {
    const url = String(e.currentTarget.dataset.url || "");
    if (!url) { wx.showToast({ title: "无合同链接", icon: "none" }); return; }
    wx.setClipboardData({ data: url, success: () => wx.showToast({ title: "链接已复制", icon: "success" }) });
  },
  openRentRecordActions(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.showActionSheet({
      itemList: ["编辑", "删除"],
      success: async (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
        } else if (res.tapIndex === 1) {
          try {
            await api.deleteCashflow(id);
            wx.showToast({ title: "已删除", icon: "success" });
            this.fetchRentRecords();
          } catch (e) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  },
  editRentRecord(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/cashflow/index?edit=1&id=${id}` });
  },
  async deleteRentRecord(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    try {
      await api.deleteCashflow(id);
      wx.showToast({ title: "已删除", icon: "success" });
      this.fetchRentRecords();
    } catch (err) {
      wx.showToast({ title: "删除失败", icon: "none" });
    }
  },
  getIcon(category) {
    return ASSET_CATEGORY_ICONS[category] || "wallet-3-line.svg";
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
  ,editValueUpdate(e) {
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
    this.setData({ showUpdateModal: true, updateValueInput: String(rec.value_raw || ''), updateDateInput: `${y}-${m}-${d}`, updateTimeInput: `${hh}:${mm}`, updateNoteInput: String(rec.note || ''), savingUpdate: false, editingUpdateId: id || null, editingUpdateTs: ts || null });
  }
  ,async deleteValueUpdate(e) {
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
  }
});
