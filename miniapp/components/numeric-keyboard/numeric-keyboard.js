Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    value: {
      type: String,
      value: ''
    },
    maxLength: {
      type: Number,
      value: 10
    },
    maxDecimals: {
      type: Number,
      value: 2
    },
    title: {
      type: String,
      value: ''
    },
    showPreview: {
      type: Boolean,
      value: true
    },
    showClear: {
      type: Boolean,
      value: true
    },
    saveButtonText: {
      type: String,
      value: '保存'
    },
    saveDisabled: {
      type: Boolean,
      value: false
    },
    theme: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap(e) {
      const val = e.currentTarget.dataset.value;
      const currentVal = String(this.data.value || '');
      
      // Prevent multiple dots
      if (val === '.' && currentVal.includes('.')) return;
      
      // Check max length (excluding dot)
      if (val !== '.' && currentVal.replace('.', '').length >= this.data.maxLength) return;

      // Check decimal precision
      if (currentVal.includes('.')) {
        const [, decimal] = currentVal.split('.');
        if (decimal && decimal.length >= this.data.maxDecimals) return;
      }

      // Initial dot handling
      let newValue = currentVal + val;
      if (newValue === '.') newValue = '0.';
      
      // Prevent leading zeros unless it's 0.
      if (newValue.length > 1 && newValue.startsWith('0') && !newValue.startsWith('0.')) {
        newValue = newValue.substring(1);
      }

      this.triggerEvent('input', { value: newValue });
    },

    handleDelete() {
      const currentVal = String(this.data.value || '');
      if (!currentVal) return;
      const newValue = currentVal.slice(0, -1);
      this.triggerEvent('input', { value: newValue });
    },

    handleClear() {
      this.triggerEvent('input', { value: '' });
    },

    handleDone() {
      this.triggerEvent('confirm', { value: this.data.value });
      this.triggerEvent('close');
    },

    handleSave() {
      if (this.data.saveDisabled) return;
      this.triggerEvent('save', { value: this.data.value });
      this.triggerEvent('close');
    },

    handleHide() {
      this.triggerEvent('close');
    },

    handleMaskTap() {
      this.triggerEvent('close');
    },
    
    preventTouchMove() {
      // Prevent background scrolling
    }
  }
});
