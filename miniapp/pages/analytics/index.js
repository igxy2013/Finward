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
  "其他": "wallet-line.svg"
};

// 负债类别图标映射
const LIABILITY_CATEGORY_ICONS = {
  "信用卡": "bank-line-red.svg",
  "消费贷": "wallet-line-red.svg",
  "房贷": "home-4-line-red.svg",
  "车贷": "car-line-red.svg",
  "借款": "money-cny-circle-line-red.svg",
  "应付款": "bill-line-red.svg",
  "其他": "wallet-line-red.svg"
};

// 获取资产类别图标
const getAssetCategoryIcon = (category) => {
  return ASSET_CATEGORY_ICONS[category] || "wallet-3-line.svg";
};

// 获取负债类别图标
const getLiabilityCategoryIcon = (category) => {
  return LIABILITY_CATEGORY_ICONS[category] || "bill-line.svg";
};

 

Page({
  data: {
    loading: true,
    error: "",
    needLogin: false,
    loggingIn: false,
    summary: {
      netWorth: "0.00",
      totalAssets: "0.00",
      totalLiabilities: "0.00",
      netChange: "0.00",
      changeRatio: "0.00%",
      changeRatioValue: 0,
      debtRatio: "0.00%",
      debtRatioValue: 0
    },
    trend: [],
    monthly: [],
    monthlyValueW: 0,
    monthlyValueH: 0,
    monthlyRatioW: 0,
    monthlyRatioH: 0,
    assetCategories: [],
    liabilityCategories: [],
    cashflow: [],
    highlights: {
      bestCategory: "-",
      bestCategoryAmount: "0.00",
      riskCategory: "-",
      riskCategoryAmount: "0.00"
    }
  },
  openCategoryDetail(e) {
    const type = String(e.currentTarget.dataset.type || "");
    const category = String(e.currentTarget.dataset.category || "");
    const target = type === 'asset' ? '/pages/assets/index' : '/pages/liabilities/index';
    const url = `${target}?category=${encodeURIComponent(category)}`;
    wx.navigateTo({ url });
  },
 
  onLoad() {
    const app = getApp();
    if (!app?.globalData?.token) {
      app.globalData.guest = true;
    }
    this.setData({ needLogin: false });
    this.fetchAnalytics();
  },
  onShow() {
    const app = getApp();
    if (!app?.globalData?.token) app.globalData.guest = true;
    if (this.data.needLogin) this.setData({ needLogin: false });
    this.fetchAnalytics(true);
  },
 
  async fetchAnalytics(quiet = false) {
    const days = 365;
    this.setData({ loading: !quiet, error: "" });
    try {
      const res = await api.fetchAnalytics(days);
      const summary = this.formatSummary(res.summary || {});
      const assetCategories = this.prepareCategories(res.asset_categories || [], "asset");
      const liabilityCategories = this.prepareCategories(res.liability_categories || [], "liability");
      const highlights = this.formatHighlights(res.highlights || {});
      this.setData(
        {
          loading: false,
          summary,
          trend: res.trend || [],
          assetCategories,
          liabilityCategories,
          cashflow: res.cashflow || [],
          highlights
        },
        () => {
          this.drawTrendChart();
          this.drawCashflowChart();
        }
      );
      try {
        const monthlyRes = await api.fetchMonthlyAnalytics(12);
        this.setData({ monthly: monthlyRes.points || [] }, () => {
          this.drawMonthlyCharts();
        });
      } catch (e2) {
        this.setData({ monthly: [] }, () => this.drawMonthlyCharts());
      }
    } catch (error) {
      // 游客模式下不显示演示数据
      this.setData({
        loading: false,
        summary: {
          netWorth: this.formatNumber(0),
          totalAssets: this.formatNumber(0),
          totalLiabilities: this.formatNumber(0),
          netChange: this.formatSignedNumber(0),
          changeRatio: "0%",
          changeRatioValue: 0,
          debtRatio: "0%",
          debtRatioValue: 0
        },
        trend: [],
        assetCategories: [],
        liabilityCategories: [],
        cashflow: [],
        monthly: [],
        highlights: {
          bestCategory: "-",
          bestCategoryAmount: "￥0.00",
          riskCategory: "-",
          riskCategoryAmount: "￥0.00"
        },
        error: ""
      });
    }
  },
  drawMonthlyCharts() {
    const points = this.data.monthly || [];
    const win = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = win.pixelRatio || 1;
    const query = wx.createSelectorQuery().in(this);
    wx.nextTick(() => {
      query
        .select('#monthlyValueCanvas').node()
        .select('#monthlyValueCanvas').boundingClientRect()
        .select('#monthlyRatioCanvas').node()
        .select('#monthlyRatioCanvas').boundingClientRect()
        .exec((res) => {
          const valueCanvas = res && res[0] && res[0].node;
          const valueRect = res && res[1];
          const ratioCanvas = res && res[2] && res[2].node;
          const ratioRect = res && res[3];
          if (!valueCanvas || !valueRect || !ratioCanvas || !ratioRect) return;
          valueCanvas.width = Math.floor(valueRect.width * dpr);
          valueCanvas.height = Math.floor(valueRect.height * dpr);
          const ctx1 = valueCanvas.getContext('2d');
          ctx1.scale(dpr, dpr);
          ratioCanvas.width = Math.floor(ratioRect.width * dpr);
          ratioCanvas.height = Math.floor(ratioRect.height * dpr);
          const ctx2 = ratioCanvas.getContext('2d');
          ctx2.scale(dpr, dpr);

          const w1 = valueRect.width, h1 = valueRect.height;
          const w2 = ratioRect.width, h2 = ratioRect.height;
          const padL = 48, padR = 20, padT = 16, padB = 26;
          const iw1 = w1 - padL - padR, ih1 = h1 - padT - padB;
          const iw2 = w2 - padL - padR, ih2 = h2 - padT - padB;

          const drawEmpty = (ctx, w, h, text) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(17,24,39,0.4)';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, w / 2, h / 2);
          };

          ctx1.clearRect(0, 0, w1, h1);
          ctx2.clearRect(0, 0, w2, h2);
          ctx1.fillStyle = 'rgba(255,255,255,0.04)';
          ctx1.fillRect(0, 0, w1, h1);
          ctx2.fillStyle = 'rgba(255,255,255,0.04)';
          ctx2.fillRect(0, 0, w2, h2);

          if (!points || points.length === 0) {
            drawEmpty(ctx1, w1, h1, '暂无月度数据');
            drawEmpty(ctx2, w2, h2, '暂无月度数据');
            return;
          }

          // 过滤掉没有数据的月份（资产、负债、净资产都为0）
          const filteredPoints = points.filter(p => {
            const a = Number(p.total_assets || 0);
            const l = Number(p.total_liabilities || 0);
            const n = Number(p.net_worth || 0);
            return Math.abs(a) > 0.01 || Math.abs(l) > 0.01 || Math.abs(n) > 0.01;
          });

          if (filteredPoints.length === 0) {
            drawEmpty(ctx1, w1, h1, '暂无月度数据');
            drawEmpty(ctx2, w2, h2, '暂无月度数据');
            return;
          }

          const assets = filteredPoints.map(p => Number(p.total_assets || 0));
          const liabilities = filteredPoints.map(p => Number(p.total_liabilities || 0));
          const net = filteredPoints.map(p => Number(p.net_worth || 0));
          const allVals = assets.concat(liabilities).concat(net);
          const maxVal = Math.max(...allVals);
          const minVal = Math.min(...allVals);
          const range = maxVal - minVal || 1;
          const toXY = (arr, idx) => {
            const x = padL + (idx / Math.max(filteredPoints.length - 1, 1)) * iw1;
            const y = padT + (1 - ((arr[idx] - minVal) / range)) * ih1;
            return { x, y };
          };
          const series = [
            { data: assets, color: '#10b981' },
            { data: liabilities, color: '#ef4444' },
            { data: net, color: '#6366f1' }
          ];
          ctx1.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx1.lineWidth = 1;
          ctx1.beginPath();
          ctx1.moveTo(padL, h1 - padB);
          ctx1.lineTo(w1 - padR, h1 - padB);
          ctx1.stroke();
          ctx1.beginPath();
          ctx1.moveTo(padL, padT);
          ctx1.lineTo(padL, h1 - padB);
          ctx1.stroke();
          const tickCount1 = 4;
          ctx1.strokeStyle = 'rgba(17,24,39,0.08)';
          for (let i = 0; i <= tickCount1; i++) {
            const y = padT + (i / tickCount1) * ih1;
            ctx1.beginPath();
            ctx1.moveTo(padL, y);
            ctx1.lineTo(w1 - padR, y);
            ctx1.stroke();
            const val = maxVal - (i / tickCount1) * range;
            ctx1.fillStyle = 'rgba(17,24,39,0.6)';
            ctx1.font = '12px sans-serif';
            ctx1.textAlign = 'right';
            ctx1.textBaseline = 'middle';
            ctx1.fillText(this.formatAxisValue(val), padL - 6, y);
          }
          series.forEach(s => {
            ctx1.strokeStyle = s.color;
            ctx1.lineWidth = 3;
            ctx1.beginPath();
            for (let i = 0; i < filteredPoints.length; i++) {
              const pt = toXY(s.data, i);
              if (i === 0) ctx1.moveTo(pt.x, pt.y); else ctx1.lineTo(pt.x, pt.y);
            }
            ctx1.stroke();
          });
          // 点标记（净资产）
          ctx1.fillStyle = '#10b981';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY(assets, i);
            ctx1.beginPath();
            ctx1.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx1.fill();
          }
          ctx1.fillStyle = '#ef4444';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY(liabilities, i);
            ctx1.beginPath();
            ctx1.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx1.fill();
          }
          ctx1.fillStyle = '#6366f1';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY(net, i);
            ctx1.beginPath();
            ctx1.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx1.fill();
          }
          ctx1.fillStyle = 'rgba(17,24,39,0.5)';
          ctx1.font = '12px sans-serif';
          ctx1.textAlign = 'center';
          for (let i = 0; i < filteredPoints.length; i++) {
            const x = padL + (i / Math.max(filteredPoints.length - 1, 1)) * iw1;
            ctx1.fillText(this.getMonthLabel(filteredPoints[i].month), x, h1 - 6);
          }
          // 选中高亮（资产图）
          const selV = typeof this._monthlyValueSelectedIdx === 'number' ? this._monthlyValueSelectedIdx : -1;
          if (selV >= 0 && selV < filteredPoints.length) {
            const x = padL + (selV / Math.max(filteredPoints.length - 1, 1)) * iw1;
            const toY1 = (v) => padT + (1 - ((v - minVal) / (range || 1))) * ih1;
            const ya = toY1(assets[selV]);
            const yl = toY1(liabilities[selV]);
            const yn = toY1(net[selV]);
            ctx1.strokeStyle = 'rgba(17,24,39,0.25)';
            ctx1.lineWidth = 1;
            ctx1.beginPath();
            ctx1.moveTo(x, padT);
            ctx1.lineTo(x, h1 - padB);
            ctx1.stroke();
            const drawDot1 = (y, color) => { ctx1.fillStyle = color; ctx1.beginPath(); ctx1.arc(x, y, 4, 0, Math.PI * 2); ctx1.fill(); };
            drawDot1(ya, '#10b981');
            drawDot1(yl, '#ef4444');
            drawDot1(yn, '#6366f1');
            const boxW = 140, boxH = 78;
            const bx = Math.min(x + 8, w1 - padR - boxW);
            const by = padT + 8;
            ctx1.fillStyle = 'rgba(255,255,255,0.9)';
            ctx1.strokeStyle = 'rgba(17,24,39,0.15)';
            ctx1.lineWidth = 1;
            ctx1.beginPath();
            ctx1.rect(bx, by, boxW, boxH);
            ctx1.fill();
            ctx1.stroke();
            ctx1.fillStyle = '#374151';
            ctx1.textAlign = 'left';
            ctx1.textBaseline = 'top';
            ctx1.fillText(this.getMonthLabel(filteredPoints[selV].month), bx + 8, by + 6);
            ctx1.fillStyle = '#10b981';
            ctx1.fillText(`资产 ${this.formatAxisValue(assets[selV])}`, bx + 8, by + 24);
            ctx1.fillStyle = '#ef4444';
            ctx1.fillText(`负债 ${this.formatAxisValue(liabilities[selV])}`, bx + 8, by + 40);
            ctx1.fillStyle = '#6366f1';
            ctx1.fillText(`净值 ${this.formatAxisValue(net[selV])}`, bx + 8, by + 56);
          }

          const ratios = filteredPoints.map(p => Number(p.debt_ratio || 0));
          const maxR = Math.max(100, Math.max(...ratios));
          const minR = Math.min(0, Math.min(...ratios));
          const rangeR = maxR - minR || 1;
          const toXY2 = (idx) => {
            const x = padL + (idx / Math.max(filteredPoints.length - 1, 1)) * iw2;
            const y = padT + (1 - ((ratios[idx] - minR) / rangeR)) * ih2;
            return { x, y };
          };
          ctx2.strokeStyle = 'rgba(17,24,39,0.15)';
          ctx2.lineWidth = 1;
          ctx2.beginPath();
          ctx2.moveTo(padL, h2 - padB);
          ctx2.lineTo(w2 - padR, h2 - padB);
          ctx2.stroke();
          ctx2.beginPath();
          ctx2.moveTo(padL, padT);
          ctx2.lineTo(padL, h2 - padB);
          ctx2.stroke();
          const tickCount2 = 4;
          ctx2.strokeStyle = 'rgba(17,24,39,0.08)';
          for (let i = 0; i <= tickCount2; i++) {
            const y = padT + (i / tickCount2) * ih2;
            ctx2.beginPath();
            ctx2.moveTo(padL, y);
            ctx2.lineTo(w2 - padR, y);
            ctx2.stroke();
            const val = maxR - (i / tickCount2) * rangeR;
            ctx2.fillStyle = 'rgba(17,24,39,0.6)';
            ctx2.font = '12px sans-serif';
            ctx2.textAlign = 'right';
            ctx2.textBaseline = 'middle';
            ctx2.fillText(`${Math.round(val)}%`, padL - 6, y);
          }
          ctx2.strokeStyle = '#8b5cf6';
          ctx2.lineWidth = 3;
          ctx2.beginPath();
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY2(i);
            if (i === 0) ctx2.moveTo(pt.x, pt.y); else ctx2.lineTo(pt.x, pt.y);
          }
          ctx2.stroke();
          // 点标记（负债率）
          ctx2.fillStyle = '#8b5cf6';
          for (let i = 0; i < filteredPoints.length; i++) {
            const pt = toXY2(i);
            ctx2.beginPath();
            ctx2.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx2.fill();
          }
          ctx2.fillStyle = 'rgba(17,24,39,0.5)';
          ctx2.font = '12px sans-serif';
          ctx2.textAlign = 'center';
          for (let i = 0; i < filteredPoints.length; i++) {
            const x = padL + (i / Math.max(filteredPoints.length - 1, 1)) * iw2;
            ctx2.fillText(this.getMonthLabel(filteredPoints[i].month), x, h2 - 6);
          }
          // 选中高亮（负债率图）
          const selR = typeof this._monthlyRatioSelectedIdx === 'number' ? this._monthlyRatioSelectedIdx : -1;
          if (selR >= 0 && selR < filteredPoints.length) {
            const x = padL + (selR / Math.max(filteredPoints.length - 1, 1)) * iw2;
            const y = padT + (1 - ((ratios[selR] - minR) / (rangeR || 1))) * ih2;
            ctx2.strokeStyle = 'rgba(17,24,39,0.25)';
            ctx2.lineWidth = 1;
            ctx2.beginPath();
            ctx2.moveTo(x, padT);
            ctx2.lineTo(x, h2 - padB);
            ctx2.stroke();
            ctx2.fillStyle = '#8b5cf6';
            ctx2.beginPath();
            ctx2.arc(x, y, 4, 0, Math.PI * 2);
            ctx2.fill();
            const boxW = 120, boxH = 54;
            const bx = Math.min(x + 8, w2 - padR - boxW);
            const by = padT + 8;
            ctx2.fillStyle = 'rgba(255,255,255,0.9)';
            ctx2.strokeStyle = 'rgba(17,24,39,0.15)';
            ctx2.lineWidth = 1;
            ctx2.beginPath();
            ctx2.rect(bx, by, boxW, boxH);
            ctx2.fill();
            ctx2.stroke();
            ctx2.fillStyle = '#374151';
            ctx2.textAlign = 'left';
            ctx2.textBaseline = 'top';
            ctx2.fillText(this.getMonthLabel(filteredPoints[selR].month), bx + 8, by + 6);
            ctx2.fillStyle = '#8b5cf6';
            ctx2.fillText(`负债率 ${Number(ratios[selR]).toFixed(1)}%`, bx + 8, by + 24);
          }

          // 交互元数据保存
          this._monthlyValueMeta = {
            padL, padR, padT, padB, iw: iw1, ih: ih1, w: w1, h: h1,
            minVal, range, assets, liabilities, net, points: filteredPoints,
            rect: valueRect, ctx: ctx1
          };
          this._monthlyRatioMeta = {
            padL, padR, padT, padB, iw: iw2, ih: ih2, w: w2, h: h2,
            minR, rangeR, ratios, points: filteredPoints,
            rect: ratioRect, ctx: ctx2
          };
        });
    });
  },
  onMonthlyValueTouch(e) {
    const meta = this._monthlyValueMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = touch.x - (meta.rect.left || 0);
    const n = Math.max(meta.points.length - 1, 1);
    const ratio = Math.min(1, Math.max(0, (localX - meta.padL) / meta.iw));
    const idx = Math.round(ratio * n);
    this._monthlyValueSelectedIdx = idx;
    this.drawMonthlyCharts();
  },
  onMonthlyRatioTouch(e) {
    const meta = this._monthlyRatioMeta;
    if (!meta) return;
    const touch = (e && e.touches && e.touches[0]) || e.detail;
    if (!touch) return;
    const localX = touch.x - (meta.rect.left || 0);
    const n = Math.max(meta.points.length - 1, 1);
    const ratio = Math.min(1, Math.max(0, (localX - meta.padL) / meta.iw));
    const idx = Math.round(ratio * n);
    this._monthlyRatioSelectedIdx = idx;
    this.drawMonthlyCharts();
  },
  getMonthLabel(dateStr) {
    if (!dateStr) return "";
    const parts = String(dateStr).split("-");
    if (parts.length < 2) return dateStr;
    return `${parseInt(parts[1])}月`;
  },
  formatAxisValue(value) {
    const v = Math.abs(Number(value || 0));
    const sign = Number(value || 0) < 0 ? '-' : '';
    if (v >= 1e8) return `${sign}${(v / 1e8).toFixed(1)}亿`;
    if (v >= 1e4) return `${sign}${(v / 1e4).toFixed(1)}万`;
    return `${sign}${Math.round(v)}`;
  },
  async handleLogin() {
    const app = getApp();
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true, error: "" });
    try {
      if (typeof app.ensureLogin === "function") {
        await app.ensureLogin();
      } else {
        await app.login();
      }
      this.setData({ needLogin: false, loggingIn: false });
      this.fetchAnalytics();
    } catch (e) {
      this.setData({ loggingIn: false, error: "登录失败，请重试" });
    }
  },
  formatSummary(summary) {
    const netWorth = this.formatNumber(summary.net_worth);
    const totalAssets = this.formatNumber(summary.total_assets);
    const totalLiabilities = this.formatNumber(summary.total_liabilities);
    const netChangeValue = Number(summary.net_change || 0);
    const changeRatioValue = Number(summary.change_ratio || 0);
    const debtRatioValue = Number(summary.debt_ratio || 0);
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      netChange: this.formatSignedNumber(netChangeValue),
      changeRatio: `${changeRatioValue >= 0 ? "+" : ""}${changeRatioValue.toFixed(2)}%`,
      changeRatioValue,
      debtRatio: `${debtRatioValue.toFixed(2)}%`,
      debtRatioValue
    };
  },
  prepareCategories(list, type) {
    return (list || []).map((item) => ({
      ...item,
      amountText: `￥${this.formatNumber(item.amount)}`,
      percentageText: `${Number(item.percentage || 0).toFixed(2)}%`,
      barClass: type === "asset" ? "asset-bar" : "liability-bar",
      icon: type === "asset" ? getAssetCategoryIcon(item.category) : getLiabilityCategoryIcon(item.category)
    }));
  },
  formatHighlights(highlights) {
    return {
      bestCategory: highlights.best_category || "-",
      bestCategoryAmount: `￥${this.formatNumber(highlights.best_category_amount)}`,
      riskCategory: highlights.risk_category || "-",
      riskCategoryAmount: `￥${this.formatNumber(highlights.risk_category_amount)}`
    };
  },
  drawTrendChart() {
    const trend = this.data.trend;
    const ctx = wx.createCanvasContext("trendChart", this);
    const query = wx.createSelectorQuery().in(this);
    query.select("#trendCanvas").boundingClientRect((rect) => {
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const innerWidth = width - padding * 2;
      const innerHeight = height - padding * 2;

      ctx.setFillStyle("rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, width, height);

      if (!trend || trend.length === 0) {
        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(14);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText("暂无趋势数据", width / 2, height / 2);
        ctx.draw();
        return;
      }

      const values = trend.map((item) => Number(item.net_worth || 0));
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const range = maxValue - minValue || 1;

      const points = trend.map((item, index) => {
        const value = Number(item.net_worth || 0);
        const x = padding + (index / Math.max(trend.length - 1, 1)) * innerWidth;
        const y = padding + (1 - (value - minValue) / range) * innerHeight;
        return { x, y };
      });

      // Axis
      ctx.setStrokeStyle("rgba(255,255,255,0.15)");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();

      // Area fill
      ctx.setFillStyle("rgba(99,102,241,0.25)");
      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding);
      points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.setStrokeStyle("#818cf8");
      ctx.setLineWidth(3);
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();

      // Dots
      ctx.setFillStyle("#c7d2fe");
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.draw();
    }).exec();
  },
  drawCashflowChart() {
    const cashflow = this.data.cashflow;
    const ctx = wx.createCanvasContext("cashflowChart", this);
    const query = wx.createSelectorQuery().in(this);
    query.select("#cashflowCanvas").boundingClientRect((rect) => {
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const chartHeight = height - padding * 2;
      const axisY = padding + chartHeight / 2;
      const barWidth = Math.max(12, (width - padding * 2) / Math.max(cashflow.length, 1) - 10);

      ctx.setFillStyle("rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, width, height);

      if (!cashflow || cashflow.length === 0) {
        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(14);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText("暂无现金流数据", width / 2, height / 2);
        ctx.draw();
        return;
      }

      const maxValue = Math.max(
        ...cashflow.map((item) => Math.max(Number(item.inflow || 0), Number(item.outflow || 0)))
      ) || 1;
      const scale = (chartHeight / 2) / maxValue;

      // Axis line
      ctx.setStrokeStyle("rgba(255,255,255,0.2)");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding, axisY);
      ctx.lineTo(width - padding, axisY);
      ctx.stroke();

      cashflow.forEach((item, index) => {
        const inflow = Number(item.inflow || 0);
        const outflow = Number(item.outflow || 0);
        const x = padding + index * (barWidth + 10) + barWidth / 2;

        const inflowHeight = inflow * scale;
        const outflowHeight = outflow * scale;

        ctx.setFillStyle("#22c55e");
        ctx.fillRect(
          x - barWidth / 2,
          axisY - inflowHeight,
          barWidth / 2 - 2,
          inflowHeight
        );

        ctx.setFillStyle("#ef4444");
        ctx.fillRect(
          x + 2,
          axisY,
          barWidth / 2 - 2,
          outflowHeight
        );

        ctx.setFillStyle("rgba(255,255,255,0.5)");
        ctx.setFontSize(12);
        ctx.setTextAlign("center");
        ctx.fillText(this.getDateLabel(item.date), x, height - 8);
      });

      ctx.draw();
    }).exec();
  },
  getDateLabel(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    return `${parts[1]}/${parts[2]}`;
  },
  formatNumber(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return "0.00";
    return num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },
  formatSignedNumber(value) {
    const num = Number(value || 0);
    const formatted = this.formatNumber(num);
    if (num > 0) return `+${formatted}`;
    if (num < 0) return `-${this.formatNumber(Math.abs(num))}`;
    return formatted;
  },
  onPullDownRefresh() {
    this.fetchAnalytics().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
