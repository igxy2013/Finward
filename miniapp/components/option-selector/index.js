Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    options: { type: Array, value: [] },
    active: { type: String, value: '' }
  },
  methods: {
    close() { this.triggerEvent('close'); },
    select(e) {
      const idx = Number(e.currentTarget.dataset.index || 0);
      const opt = (this.data.options || [])[idx];
      if (!opt) return;
      this.triggerEvent('select', { index: idx, option: opt });
    }
  }
});
