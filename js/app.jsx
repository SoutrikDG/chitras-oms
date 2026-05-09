/**
 * CHITRAS OMS — React Application v3
 *
 * Fixes in this version:
 *  1. Drafts error handled (backend null safety + frontend error display)
 *  2. Colour from Admin_Config (REF_Colour) + past data
 *  3. Sub-channels from Admin_Config via OMS_API.getSubChannels
 *  4. Product pre-selected as default (95% of orders)
 *  5. Stitching shows minimal form (no product fields)
 *  6. Order type change dynamically resets + adapts UI
 *  7. Performance: getBootstrap (1 call instead of 4)
 *  8. Branding: Chitras (no apostrophe) everywhere
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ═══════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Toast({ message, type, onClose }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2500);
    const t2 = setTimeout(onClose, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={`toast toast-${type} ${leaving ? 'anim-toastOut' : 'anim-toastIn'}`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card anim-fadeInUp" onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          {title}
        </h3>
        <p style={{ fontSize: 14, color: '#5C3D2E', marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="submit-btn submit-secondary"
            style={{ flex: 1, padding: 12, fontSize: 14 }}
            onClick={onCancel}
          >Cancel</button>
          <button
            className="submit-btn submit-primary"
            style={{ flex: 1, padding: 12, fontSize: 14 }}
            onClick={onConfirm}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ChipSelector({ options, value, onChange, label, alt, required }) {
  return (
    <div>
      {label && (
        <div className="field-label">
          {label}{required && <span className="req">*</span>}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => (
          <div
            key={opt}
            className={`chip ${value === opt ? (alt ? 'selected-alt' : 'selected') : ''} ${value === opt ? 'anim-chipPop' : ''}`}
            onClick={() => {
              if (required && opt === value) return;
              onChange(opt === value ? '' : opt);
            }}
          >{opt}</div>
        ))}
      </div>
    </div>
  );
}

function ComboBox({ value, onCommit, options = [], label, placeholder, allowNew, refKey, onAddConfig, required }) {
  const [input, setInput] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { setInput(value || ''); }, [value]);

  const filtered = useMemo(() => {
    if (!input) return options.slice(0, 8);
    const q = input.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q)).slice(0, 8);
  }, [input, options]);

  const isNew = input.trim() && !options.some(o => o.toLowerCase() === input.trim().toLowerCase());

  const handleSelect = (opt) => {
    setInput(opt);
    onCommit(opt);
    setOpen(false);
    setShowConfirm(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      const t = input.trim();
      if (!t) { onCommit(''); return; }
      if (isNew && allowNew) {
        setShowConfirm(true);
      } else {
        const match = options.find(o => o.toLowerCase() === t.toLowerCase());
        if (match) { setInput(match); onCommit(match); }
        else if (!allowNew) { setInput(value || ''); }
        else { onCommit(t); }
      }
    }, 200);
  };

  const confirmNew = async () => {
    const t = input.trim();
    if (onAddConfig && refKey) {
      try {
        await OMS_API.post({ action: 'addConfigValue', ref_key: refKey, value: t });
        onAddConfig(refKey, t);
      } catch (e) { /* ignore */ }
    }
    onCommit(t);
    setShowConfirm(false);
  };

  const rejectNew = () => {
    setInput(value || '');
    onCommit(value || '');
    setShowConfirm(false);
  };

  return (
    <div className="combo-wrap">
      {label && (
        <div className="field-label">
          {label}{required && <span className="req">*</span>}
        </div>
      )}
      <input
        className="field-input"
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true); setShowConfirm(false); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder || `Select ${label || ''}...`}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="combo-dropdown">
          {filtered.map(opt => (
            <div key={opt} className="combo-option" onMouseDown={() => handleSelect(opt)}>
              {opt}
            </div>
          ))}
        </div>
      )}
      {showConfirm && (
        <div className="confirm-bar anim-fadeInUp">
          <span style={{ flex: 1 }}>
            Add <strong>"{input.trim()}"</strong> as new {label?.toLowerCase() || 'value'}?
          </span>
          <button className="confirm-btn confirm-yes" onClick={confirmNew}>✓</button>
          <button className="confirm-btn confirm-no" onClick={rejectNew}>✗</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PIN SCREEN
// ═══════════════════════════════════════════════════════════════

function PinScreen({ onAuth, configPin, configError }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (configError) {
    return (
      <div className="pin-screen">
        <div className="anim-fadeInUp" style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, fontWeight: 700, color: 'var(--terra-900)' }}>
            Chitras
          </h1>
          <p style={{ fontSize: 13, color: 'var(--terra-800)', opacity: .6, letterSpacing: 2, marginBottom: 32 }}>
            ORDER MANAGEMENT
          </p>
          <div className="card" style={{ width: 300, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
            <p style={{ fontSize: 14, color: 'var(--red)', fontWeight: 500 }}>Cannot connect to server</p>
            <p style={{ fontSize: 12, color: '#8B6F5E', marginTop: 8 }}>
              Check your internet or API URL and reload.
            </p>
            <button
              className="submit-btn submit-primary"
              style={{ marginTop: 16 }}
              onClick={() => window.location.reload()}
            >Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const handleAuth = () => {
    if (pin === String(configPin)) {
      onAuth();
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  return (
    <div className="pin-screen">
      <div className="anim-fadeInUp" style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, fontWeight: 700, color: 'var(--terra-900)', letterSpacing: -1, marginBottom: 4 }}>
          Chitras
        </h1>
        <p style={{ fontSize: 13, color: 'var(--terra-800)', opacity: .6, letterSpacing: 2, marginBottom: 40 }}>
          ORDER MANAGEMENT
        </p>
        <div className="card" style={{ width: 280, textAlign: 'center' }}>
          <p className="field-label" style={{ marginBottom: 16 }}>Enter PIN to continue</p>
          <input
            className="field-input"
            style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            maxLength={10}
            autoFocus
            placeholder="• • • •"
          />
          {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{error}</p>}
          <button
            className="submit-btn submit-primary"
            style={{ marginTop: 16 }}
            onClick={handleAuth}
          >Enter</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER + NAV
// ═══════════════════════════════════════════════════════════════

function Header({ isOnline }) {
  const offCount = isOnline ? 0 : OMS_API.getOfflineCount();
  return (
    <div className="app-header">
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: 'var(--terra-900)', letterSpacing: -.5 }}>
        Chitras
      </span>
      {!isOnline && (
        <div className="offline-badge anim-pulse">
          <span>●</span>
          <span>Offline{offCount > 0 ? ` (${offCount} queued)` : ''}</span>
        </div>
      )}
    </div>
  );
}

function BottomNav({ active, onChange, pendingCount }) {
  const tabs = [
    { id: 'new',     icon: '＋', label: 'New Order' },
    { id: 'recent',  icon: '☰', label: 'Recent' },
    { id: 'pending', icon: '◷', label: 'Pending', badge: pendingCount },
  ];
  return (
    <div className="bottom-nav">
      {tabs.map(t => (
        <div
          key={t.id}
          className={`nav-tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.badge > 0 && <span className="nav-badge">{t.badge}</span>}
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function DraftBanner({ drafts, onResume, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  if (!drafts.length) return null;
  return (
    <div style={{ margin: '0 0 12px' }}>
      <div className="draft-banner" onClick={() => setExpanded(!expanded)}>
        <span>📋 {drafts.length} draft{drafts.length > 1 ? 's' : ''}</span>
        <span style={{ fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="card anim-fadeInUp" style={{ marginTop: 4, padding: 12 }}>
          {drafts.map(d => (
            <div key={d.draft_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--cream-dk)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{d.customer_name || 'Unnamed'}</div>
                <div style={{ fontSize: 11, color: '#8B6F5E' }}>{d.created_at}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="chip selected" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => onResume(d)}>Resume</button>
                <button className="chip" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => onDelete(d.draft_id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ORDER CARD
// ═══════════════════════════════════════════════════════════════

function OrderCard({ order, showMarkPaid, onMarkPaid }) {
  const [expanded, setExpanded] = useState(false);
  const bc = { Pending: 'badge-pending', Partial: 'badge-partial', Completed: 'badge-completed' };

  return (
    <div className="order-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{order.customer_name}</span>
            <span className={`badge ${bc[order.payment_status] || ''}`}>{order.payment_status}</span>
          </div>
          <div style={{ fontSize: 11, color: '#8B6F5E' }}>
            {order.order_date} · {order.sub_channel} · {order.order_id}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700 }}>
            ₹{parseFloat(order.total_bill_amount || 0).toLocaleString('en-IN')}
          </div>
          {order.balance_due > 0 && (
            <div style={{ fontSize: 11, color: 'var(--terra-500)' }}>
              Due: ₹{order.balance_due.toLocaleString('en-IN')}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="anim-fadeInUp" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--cream-dk)' }}>
          {(order.items || []).map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
              <span style={{ color: 'var(--terra-800)' }}>
                {[it.division, it.fabric, it.category].filter(Boolean).join(' · ')}
                {it.quantity > 1 ? ` ×${it.quantity}` : ''}
              </span>
              <span style={{ fontWeight: 500 }}>
                ₹{parseFloat(it.line_total || it.total_bill || 0).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
          {parseFloat(order.shipping_charge) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#8B6F5E' }}>
              <span>Shipping</span>
              <span>₹{parseFloat(order.shipping_charge).toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0 0', marginTop: 4, borderTop: '1px solid var(--cream-dk)', color: 'var(--olive)' }}>
            <span>Paid</span>
            <span style={{ fontWeight: 600 }}>₹{parseFloat(order.amount_paid || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {showMarkPaid && order.balance_due > 0 && (
        <button
          className="submit-btn submit-primary"
          style={{ marginTop: 12, padding: 12, fontSize: 14 }}
          onClick={e => { e.stopPropagation(); onMarkPaid(order); }}
        >
          Mark as Paid — ₹{order.balance_due.toLocaleString('en-IN')}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW ORDER TAB
// ═══════════════════════════════════════════════════════════════

const ORDER_TYPES = ['Product', 'Stitching'];

function NewOrderTab({ config, suggestions, onSubmit, onSaveDraft, showToast, draftToResume, onClearDraft, onDirtyChange }) {
  const [orderType, setOrderType]         = useState(OMS_CONFIG.DEFAULT_ORDER_TYPE);
  const [channel, setChannel]             = useState('');
  const [subChannel, setSubChannel]       = useState('');
  const [orderDate, setOrderDate]         = useState(OMS_API.todayLocal());
  const [items, setItems]                 = useState([{ ...OMS_CONFIG.EMPTY_ITEM }]);
  const [shippingCharge, setShippingCharge] = useState('');
  const [amountPaid, setAmountPaid]       = useState('');
  const [payChoice, setPayChoice]         = useState('');
  const [paymentMode, setPaymentMode]     = useState('');
  const [fulfilmentType, setFulfilmentType] = useState('');
  const [customerName, setCustomerName]   = useState('');
  const [phone, setPhone]                 = useState('');
  const [orderNotes, setOrderNotes]       = useState('');
  const [showNotes, setShowNotes]         = useState(false);
  const [stitchDesc, setStitchDesc]       = useState('');
  const [stitchPrice, setStitchPrice]     = useState('');
  const [custSuggOpen, setCustSuggOpen]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState([]);
  const [localConfig, setLocalConfig]     = useState(config);
  const [activeDraftId, setActiveDraftId] = useState(null);

  const isStitching = orderType === 'Stitching';

  const isDirty = !!(customerName || (isStitching ? stitchPrice : items.some(it => it.base_price || it.fabric || it.category)));
  useEffect(() => { if (onDirtyChange) onDirtyChange(isDirty); }, [isDirty]);

  // Resume draft
  useEffect(() => {
    if (!draftToResume) return;
    const p = draftToResume.payload || draftToResume;
    setOrderType(p.order_type || OMS_CONFIG.DEFAULT_ORDER_TYPE);
    setChannel(p.channel || '');
    setSubChannel(p.sub_channel || '');
    setOrderDate(p.order_date || OMS_API.todayLocal());
    setItems(p.items?.length ? p.items : [{ ...OMS_CONFIG.EMPTY_ITEM }]);
    setShippingCharge(p.shipping_charge || '');
    setAmountPaid(p.amount_paid || '');
    setPayChoice(p.amount_paid > 0 ? 'custom' : '');
    setPaymentMode(p.payment_mode || '');
    setFulfilmentType(p.fulfilment_type || '');
    setCustomerName(p.customer_name || '');
    setPhone(p.phone_number || '');
    setOrderNotes(p.order_notes || '');
    setStitchDesc(p.order_notes || '');
    setStitchPrice(p.items?.[0]?.base_price || '');
    setActiveDraftId(draftToResume.draft_id || null);
    if (onClearDraft) onClearDraft();
  }, [draftToResume]);

  // Auto-set fulfilment when channel changes
  useEffect(() => {
    if (channel) setFulfilmentType(channel === 'Online' ? 'Shipping' : 'Spot');
  }, [channel]);

  const handleOrderTypeChange = (newType) => {
    if (newType === orderType) return;
    setOrderType(newType);
    setItems([{ ...OMS_CONFIG.EMPTY_ITEM }]);
    setStitchDesc('');
    setStitchPrice('');
    setShippingCharge('');
    setAmountPaid('');
    setPayChoice('');
    setErrors([]);
    if (newType === 'Stitching' && !channel) {
      setChannel('Offline');
      setSubChannel('Studio');
    }
  };

  useEffect(() => { setLocalConfig(config); }, [config]);

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };
  const addItem    = () => setItems(prev => [...prev, { ...OMS_CONFIG.EMPTY_ITEM }]);
  const removeItem = (idx) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  const handleAddConfig = (refKey, value) => {
    setLocalConfig(prev => ({ ...prev, [refKey]: [...(prev[refKey] || []), value] }));
  };

  const itemsTotal = isStitching
    ? (parseFloat(stitchPrice) || 0)
    : items.reduce((s, it) => s + (parseFloat(it.base_price) || 0) * (parseInt(it.quantity) || 1), 0);
  const orderTotal = itemsTotal + (parseFloat(shippingCharge) || 0);

  const subChannelOptions = OMS_API.getSubChannels(localConfig, channel);

  const getCategorySugg = (fabric) => {
    const aff = suggestions?.fabric_category_affinity?.[fabric] || [];
    const all = localConfig?.REF_Category || [];
    return [...aff, ...all.filter(c => !aff.includes(c))];
  };

  const getColourSugg = (category) => {
    const fromData   = suggestions?.colour_by_category?.[category] || [];
    const fromConfig = localConfig?.REF_Colour || [];
    const merged = [...fromData];
    fromConfig.forEach(c => { if (!merged.some(m => m.toLowerCase() === c.toLowerCase())) merged.push(c); });
    return merged;
  };

  const suggestPrice = (item) => {
    if (!suggestions?.price_by_sku) return null;
    const sku = OMS_API.buildPartialSku(item);
    return sku.includes('UNK') ? null : (suggestions.price_by_sku[sku] || null);
  };

  const custFiltered = useMemo(() => {
    if (!customerName || customerName.length < 2) return [];
    const q = customerName.toLowerCase();
    return (suggestions?.customers || []).filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(customerName)
    ).slice(0, 5);
  }, [customerName, suggestions]);

  const selectCustomer = (c) => {
    setCustomerName(c.name);
    setPhone(c.phone);
    setCustSuggOpen(false);
  };

  const validate = () => {
    const e = [];
    if (!orderType)  e.push('Order Type required');
    if (!channel)    e.push('Channel required');
    if (!subChannel) e.push('Sub-channel required');
    if (!customerName.trim()) e.push('Customer Name required');
    if (!OMS_API.isValidPhone(phone)) e.push('Phone must be exactly 10 digits');
    if (amountPaid === '' && !payChoice) e.push('Payment required — select Full, No Payment, or enter amount');
    if (isStitching) {
      if (!stitchPrice) e.push('Stitching price required');
    } else {
      items.forEach((it, idx) => {
        if (!it.division && !it.category) e.push(`Item ${idx + 1}: Division or Category required`);
        if (!it.base_price && it.base_price !== 0) e.push(`Item ${idx + 1}: Price required`);
      });
    }
    return e;
  };

  const buildPayload = () => {
    const itemsPayload = isStitching
      ? [{ category: 'Stitching', base_price: parseFloat(stitchPrice) || 0, quantity: 1, division: '', fabric: '', sub_category: 'STD', size: 'FS', colour: '' }]
      : items.map(it => ({
          division:      it.division,
          fabric:        it.fabric,
          category:      it.category,
          sub_category:  it.sub_category || 'STD',
          size:          it.size || 'FS',
          colour:        it.colour,
          quantity:      parseInt(it.quantity) || 1,
          base_price:    parseFloat(it.base_price) || 0,
        }));
    return {
      action:          'submitOrder',
      order_type:      orderType,
      order_date:      orderDate,
      channel,
      sub_channel:     subChannel,
      customer_name:   customerName.trim(),
      phone_number:    phone.replace(/\D/g, ''),
      shipping_charge: parseFloat(shippingCharge) || 0,
      amount_paid:     parseFloat(amountPaid) || 0,
      payment_mode:    paymentMode,
      fulfilment_type: fulfilmentType,
      order_notes:     isStitching ? stitchDesc : orderNotes,
      items:           itemsPayload
    };
  };

  const handleSubmit = async () => {
    const e = validate();
    if (e.length) { setErrors(e); return; }
    setErrors([]);
    setSubmitting(true);
    const payload = buildPayload();
    try {
      if (!navigator.onLine) {
        const cnt = OMS_API.addToOfflineQueue(payload);
        showToast(`Order queued offline (${cnt} pending)`, 'success');
      } else {
        const r = await OMS_API.post(payload);
        if (r.status === 'success' || r._html_response) {
          showToast(r.order_id ? `Order ${r.order_id} saved!` : 'Order saved!', 'success');
          if (activeDraftId) {
            try { await OMS_API.post({ action: 'deleteDraft', draft_id: activeDraftId }); } catch (e) { /* ignore */ }
          }
          if (onSubmit) onSubmit();
        } else {
          showToast(r.message || 'Failed', 'error');
          setSubmitting(false);
          return;
        }
      }
      resetForm();
    } catch (err) {
      OMS_API.addToOfflineQueue(payload);
      showToast('Queued offline', 'success');
      resetForm();
    }
    setSubmitting(false);
  };

  const handleSaveDraft = async () => {
    const payload = { ...buildPayload(), action: 'saveDraft', device_hint: navigator.userAgent.slice(0, 50) };
    try {
      if (!navigator.onLine) { showToast('No internet — cannot save draft', 'error'); return; }
      const r = await OMS_API.post(payload);
      if (r.status === 'success') {
        showToast('Draft saved', 'success');
        if (onSaveDraft) onSaveDraft();
        resetForm();
      } else {
        showToast(r.message || 'Draft failed', 'error');
      }
    } catch (err) {
      showToast('Draft failed', 'error');
    }
  };

  const resetForm = () => {
    setOrderType(OMS_CONFIG.DEFAULT_ORDER_TYPE);
    setChannel(''); setSubChannel('');
    setOrderDate(OMS_API.todayLocal());
    setItems([{ ...OMS_CONFIG.EMPTY_ITEM }]);
    setShippingCharge(''); setAmountPaid(''); setPayChoice('');
    setPaymentMode(''); setFulfilmentType('');
    setCustomerName(''); setPhone('');
    setOrderNotes(''); setShowNotes(false);
    setStitchDesc(''); setStitchPrice('');
    setErrors([]); setActiveDraftId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-content" style={{ paddingTop: 8 }}>

      {/* ORDER TYPE */}
      <div className="anim-fadeInUp">
        <ChipSelector
          label="Order Type"
          options={ORDER_TYPES}
          value={orderType}
          onChange={handleOrderTypeChange}
          required
        />
      </div>

      {/* DATE */}
      <div className="section-gap anim-fadeInUp">
        <div className="field-label">Order Date<span className="req">*</span></div>
        <input
          type="date"
          className="field-input"
          value={orderDate}
          onChange={e => setOrderDate(e.target.value)}
        />
      </div>

      {/* CHANNEL */}
      <div className="card section-gap anim-fadeInUp">
        <ChipSelector
          label="Channel"
          options={localConfig?.REF_Channel || ['Online', 'Offline']}
          value={channel}
          onChange={v => { setChannel(v); setSubChannel(''); }}
          required
        />
        {channel && subChannelOptions.length > 0 && (
          <div className="section-gap anim-fadeInUp">
            <ChipSelector
              label="Sub-Channel"
              options={subChannelOptions}
              value={subChannel}
              onChange={setSubChannel}
              alt
              required
            />
          </div>
        )}
      </div>

      {/* PRODUCT ITEMS */}
      {!isStitching && channel && subChannel && (
        <div className="card section-gap anim-fadeInUp">
          <div className="field-label" style={{ marginBottom: 12 }}>Items</div>
          {items.map((item, idx) => {
            const priceSugg = suggestPrice(item);
            return (
              <div
                key={idx}
                className={idx > 0 ? 'anim-slideIn' : ''}
                style={idx > 0 ? { marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--cream-dk)' } : {}}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8B6F5E', opacity: .6 }}>ITEM {idx + 1}</span>
                  {items.length > 1 && (
                    <button style={{ fontSize: 12, color: 'var(--terra-500)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => removeItem(idx)}>
                      Remove
                    </button>
                  )}
                </div>

                <ChipSelector
                  label="Division"
                  options={localConfig?.REF_Division || []}
                  value={item.division}
                  onChange={v => updateItem(idx, 'division', v)}
                  required
                />

                <div className="section-gap">
                  <ComboBox
                    label="Fabric"
                    value={item.fabric}
                    onCommit={v => updateItem(idx, 'fabric', v)}
                    options={localConfig?.REF_Fabric || []}
                    allowNew
                    refKey="REF_Fabric"
                    onAddConfig={handleAddConfig}
                  />
                </div>

                <div className="section-gap">
                  <ComboBox
                    label="Category"
                    value={item.category}
                    onCommit={v => updateItem(idx, 'category', v)}
                    options={item.fabric ? getCategorySugg(item.fabric) : (localConfig?.REF_Category || [])}
                    allowNew
                    refKey="REF_Category"
                    onAddConfig={handleAddConfig}
                    required
                  />
                </div>

                <div className="section-gap">
                  <ComboBox
                    label="Sub-Category"
                    value={item.sub_category}
                    onCommit={v => updateItem(idx, 'sub_category', v)}
                    options={localConfig?.REF_SubCategory || []}
                    allowNew
                    refKey="REF_SubCategory"
                    onAddConfig={handleAddConfig}
                  />
                </div>

                <div className="section-gap">
                  <ChipSelector
                    label="Size"
                    options={(localConfig?.REF_Size || ['FS', 'Custom', '32', '34', '36', '38', '40', '42', '44']).map(String)}
                    value={String(item.size || '')}
                    onChange={v => updateItem(idx, 'size', v)}
                  />
                </div>

                <div className="section-gap">
                  <ComboBox
                    label="Colour"
                    value={item.colour}
                    onCommit={v => updateItem(idx, 'colour', v)}
                    options={getColourSugg(item.category)}
                    allowNew={true}
                    placeholder="Type colour..."
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <div style={{ width: 80 }}>
                    <div className="field-label">Qty<span className="req">*</span></div>
                    <input
                      className="field-input"
                      style={{ textAlign: 'center' }}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label">Unit Price (₹)<span className="req">*</span></div>
                    <input
                      className="field-input"
                      type="number"
                      inputMode="decimal"
                      value={item.base_price}
                      onChange={e => updateItem(idx, 'base_price', e.target.value)}
                      placeholder="0"
                    />
                    {priceSugg && !item.base_price && (
                      <div
                        style={{ fontSize: 11, color: 'var(--olive)', marginTop: 4, cursor: 'pointer' }}
                        onClick={() => updateItem(idx, 'base_price', String(priceSugg))}
                      >
                        💡 Last price: ₹{priceSugg.toLocaleString('en-IN')} — tap to use
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: 13, color: '#8B6F5E', marginTop: 4 }}>
                  Line: ₹{((parseFloat(item.base_price) || 0) * (parseInt(item.quantity) || 1)).toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
          <button className="submit-btn submit-ghost" style={{ marginTop: 16 }} onClick={addItem}>
            + Add Another Item
          </button>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--cream-dk)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#8B6F5E' }}>Items Total</span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700 }}>
              ₹{itemsTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {/* STITCHING DETAILS */}
      {isStitching && channel && subChannel && (
        <div className="card section-gap anim-fadeInUp">
          <div className="field-label" style={{ marginBottom: 12 }}>Stitching Details</div>
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Description</div>
            <textarea
              className="field-input"
              rows="2"
              value={stitchDesc}
              onChange={e => setStitchDesc(e.target.value)}
              placeholder="What stitching work is needed..."
            />
          </div>
          <div>
            <div className="field-label">Quoted Price (₹)<span className="req">*</span></div>
            <input
              className="field-input"
              type="number"
              inputMode="decimal"
              value={stitchPrice}
              onChange={e => setStitchPrice(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      )}

      {/* PAYMENT */}
      {channel && subChannel && (
        <div className="card section-gap anim-fadeInUp">
          <div className="field-label" style={{ marginBottom: 12 }}>Payment</div>
          {!isStitching && (
            <div style={{ marginBottom: 12 }}>
              <div className="field-label">Shipping Charge (₹)</div>
              <input
                className="field-input"
                type="number"
                inputMode="decimal"
                value={shippingCharge}
                onChange={e => setShippingCharge(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--cream)', borderRadius: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#8B6F5E' }}>Order Total</span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700 }}>
              ₹{orderTotal.toLocaleString('en-IN')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className={`chip ${payChoice === 'full' ? 'selected' : ''}`}
              style={{ flex: 1 }}
              onClick={() => { setPayChoice('full'); setAmountPaid(String(orderTotal)); }}
            >Full Payment</button>
            <button
              className={`chip ${payChoice === 'none' ? 'selected-alt' : ''}`}
              style={{ flex: 1 }}
              onClick={() => { setPayChoice('none'); setAmountPaid('0'); }}
            >No Payment</button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Amount Paid (₹)</div>
            <input
              className="field-input"
              type="number"
              inputMode="decimal"
              value={amountPaid}
              onChange={e => { setAmountPaid(e.target.value); setPayChoice('custom'); }}
              placeholder="0"
            />
          </div>
          <ChipSelector
            label="Payment Mode"
            options={localConfig?.REF_PaymentMode || ['Online', 'Cash', 'Card']}
            value={paymentMode}
            onChange={setPaymentMode}
          />
          <div className="section-gap">
            <ChipSelector
              label="Fulfilment"
              options={localConfig?.REF_Fulfilment || ['Shipping', 'Spot']}
              value={fulfilmentType}
              onChange={setFulfilmentType}
            />
          </div>
        </div>
      )}

      {/* CUSTOMER */}
      {channel && subChannel && (
        <div className="card section-gap anim-fadeInUp">
          <div className="field-label" style={{ marginBottom: 12 }}>Customer</div>
          <div className="combo-wrap" style={{ marginBottom: 12 }}>
            <div className="field-label">Name<span className="req">*</span></div>
            <input
              className="field-input"
              value={customerName}
              onChange={e => { setCustomerName(e.target.value); setCustSuggOpen(true); }}
              onFocus={() => setCustSuggOpen(true)}
              onBlur={() => {
                setTimeout(() => setCustSuggOpen(false), 200);
                if (customerName.trim()) setCustomerName(OMS_API.toTitleCase(customerName));
              }}
              placeholder="Customer name..."
            />
            {custSuggOpen && custFiltered.length > 0 && (
              <div className="combo-dropdown">
                {custFiltered.map(c => (
                  <div key={c.phone} className="combo-option" onMouseDown={() => selectCustomer(c)}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#8B6F5E' }}>{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Phone<span className="req">*</span></div>
            <input
              className="field-input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="10-digit number"
              maxLength={10}
            />
          </div>
          {!isStitching && (
            !showNotes
              ? <button style={{ fontSize: 12, color: 'var(--terra-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowNotes(true)}>
                  + Add note
                </button>
              : <div className="anim-fadeInUp">
                  <div className="field-label">Order Notes</div>
                  <textarea
                    className="field-input"
                    rows="2"
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Special instructions..."
                  />
                </div>
          )}
        </div>
      )}

      {/* ERRORS */}
      {errors.length > 0 && (
        <div className="card section-gap anim-fadeInUp" style={{ borderColor: 'var(--red)', background: 'var(--red-lt)' }}>
          <div className="field-label" style={{ color: 'var(--red)', marginBottom: 4 }}>Please fix:</div>
          {errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: 'var(--red)' }}>• {e}</div>)}
        </div>
      )}

      {/* SUBMIT */}
      <div className="section-gap anim-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="submit-btn submit-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <><span className="spinner"></span>Submitting...</> : 'Submit Order'}
        </button>
        <button className="submit-btn submit-secondary" onClick={handleSaveDraft}>
          Save as Draft
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RECENT ORDERS TAB
// ═══════════════════════════════════════════════════════════════

function RecentOrdersTab({ showToast }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset]   = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = async (off = 0, append = false) => {
    setLoading(true);
    try {
      const d = await OMS_API.get('getRecentOrders', { offset: off });
      if (d.status === 'success') {
        setOrders(prev => append ? [...prev, ...d.orders] : d.orders);
        setHasMore(d.has_more);
        setOffset(off);
      }
    } catch (e) {
      showToast('Failed to load', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(0); }, []);

  return (
    <div className="page-content" style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Recent Orders
        </h2>
        <button style={{ fontSize: 12, color: 'var(--terra-500)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => load(0)}>
          Refresh
        </button>
      </div>
      {loading && !orders.length
        ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B6F5E' }} className="anim-pulse">Loading...</div>
        : orders.length === 0
          ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B6F5E' }}>No orders yet</div>
          : <div>
              {orders.map(o => <OrderCard key={o.order_id} order={o} />)}
              {hasMore && (
                <button
                  className="submit-btn submit-ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => load(offset + 5, true)}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load 5 more'}
                </button>
              )}
            </div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PENDING PAYMENTS TAB
// ═══════════════════════════════════════════════════════════════

function PendingPaymentsTab({ showToast, onPendingCountChange }) {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [confirmOrder, setConfirmOrder] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await OMS_API.get('getRecentOrders', { filter: 'pending' });
      if (d.status === 'success') {
        setOrders(d.orders);
        if (onPendingCountChange) onPendingCountChange(d.total_distinct_orders || 0);
      }
    } catch (e) {
      showToast('Failed to load', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const doMarkPaid = async () => {
    const o = confirmOrder;
    setConfirmOrder(null);
    try {
      const totalBill = parseFloat(o.total_bill_amount) || 0;
      const r = await OMS_API.post({
        action:   'update',
        order_id: String(o.order_id),
        fields:   { amount_paid: totalBill, order_status: 'Processing' }
      });
      if (r.status === 'success' || r._html_response) {
        showToast(`${o.customer_name} — Paid!`, 'success');
        load();
      } else {
        showToast(r.message || 'Update failed — try again', 'error');
      }
    } catch (err) {
      showToast('Network error — check connection', 'error');
    }
  };

  const totalDue = orders.reduce((s, o) => s + (o.balance_due || 0), 0);

  return (
    <div className="page-content" style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Pending Payments
        </h2>
        <button style={{ fontSize: 12, color: 'var(--terra-500)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={load}>
          Refresh
        </button>
      </div>
      {totalDue > 0 && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, background: 'rgba(232,213,163,.15)' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Total Outstanding</span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700 }}>
            ₹{totalDue.toLocaleString('en-IN')}
          </span>
        </div>
      )}
      {loading
        ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B6F5E' }} className="anim-pulse">Loading...</div>
        : orders.length === 0
          ? <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ color: '#8B6F5E' }}>All payments received!</div>
            </div>
          : <div>{orders.map(o => <OrderCard key={o.order_id} order={o} showMarkPaid onMarkPaid={o => setConfirmOrder(o)} />)}</div>
      }
      {confirmOrder && (
        <ConfirmModal
          title="Confirm Payment"
          message={`Mark ₹${confirmOrder.balance_due.toLocaleString('en-IN')} as received from ${confirmOrder.customer_name}?`}
          confirmLabel="Mark as Paid"
          onConfirm={doMarkPaid}
          onCancel={() => setConfirmOrder(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════

function App() {
  const cached = OMS_API.readCachedBootstrap();
  const [authed, setAuthed]               = useState(false);
  const [config, setConfig]               = useState(cached?.config || null);
  const [configError, setConfigError]     = useState(false);
  const [suggestions, setSuggestions]     = useState(cached?.suggestions || null);
  const [drafts, setDrafts]               = useState([]);
  const [activeTab, setActiveTab]         = useState('new');
  const [toast, setToast]                 = useState(null);
  const [loading, setLoading]             = useState(!cached);
  const [draftToResume, setDraftToResume] = useState(null);
  const [pendingCount, setPendingCount]   = useState(0);
  const [formDirty, setFormDirty]         = useState(false);
  const [pendingTabSwitch, setPendingTabSwitch] = useState(null);
  const isOnline = useOnlineStatus();

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ message: msg, type, key: Date.now() });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = await OMS_API.getBootstrap();
        if (d.status === 'success') {
          setConfig(d.config);
          setSuggestions(d.suggestions);
          setDrafts(d.drafts || []);
          setPendingCount(d.pending_count || 0);
        } else {
          setConfigError(true);
        }
      } catch (e) {
        setConfigError(true);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    OMS_API.syncOfflineQueue().then(r => {
      if (r.synced > 0) showToast(`Synced ${r.synced} offline order(s)`, 'success');
    });
    OMS_API.get('getBootstrap').then(d => {
      if (d.status === 'success') {
        setConfig(d.config);
        setSuggestions(d.suggestions);
        setDrafts(d.drafts || []);
        setPendingCount(d.pending_count || 0);
        OMS_API._cacheBootstrap(d);
      }
    }).catch(() => {});
  }, [authed]);

  useEffect(() => {
    if (isOnline && authed) {
      OMS_API.syncOfflineQueue().then(r => {
        if (r.synced > 0) showToast(`Synced ${r.synced} offline order(s)`);
      });
    }
  }, [isOnline, authed]);

  const refresh = async () => {
    try {
      const d = await OMS_API.get('getBootstrap');
      if (d.status === 'success') {
        setConfig(d.config);
        setSuggestions(d.suggestions);
        setDrafts(d.drafts || []);
        setPendingCount(d.pending_count || 0);
        OMS_API._cacheBootstrap(d);
      }
    } catch (e) { /* ignore */ }
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    if (formDirty && activeTab === 'new') {
      setPendingTabSwitch(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const confirmTabSwitch = () => {
    const t = pendingTabSwitch;
    setPendingTabSwitch(null);
    setFormDirty(false);
    setActiveTab(t);
  };

  const handleSubmitted = () => {
    setFormDirty(false);
    refresh();
  };

  if (loading) {
    return (
      <div className="pin-screen">
        <div style={{ textAlign: 'center' }} className="anim-pulse">
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, fontWeight: 700, color: 'var(--terra-900)' }}>
            Chitras
          </h1>
          <p style={{ fontSize: 13, color: '#8B6F5E' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <>
        <PinScreen
          configPin={config?.REF_PIN?.[0]}
          onAuth={() => setAuthed(true)}
          configError={configError}
        />
        {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Header isOnline={isOnline} />
      {activeTab === 'new' && (
        <>
          <div style={{ padding: '0 16px' }}>
            <DraftBanner
              drafts={drafts}
              onResume={d => { setDraftToResume(d); setActiveTab('new'); }}
              onDelete={async id => {
                try {
                  await OMS_API.post({ action: 'deleteDraft', draft_id: id });
                  refresh();
                  showToast('Deleted');
                } catch (e) {
                  showToast('Failed', 'error');
                }
              }}
            />
          </div>
          <NewOrderTab
            config={config}
            suggestions={suggestions}
            showToast={showToast}
            onSubmit={handleSubmitted}
            onSaveDraft={refresh}
            draftToResume={draftToResume}
            onClearDraft={() => setDraftToResume(null)}
            onDirtyChange={setFormDirty}
          />
        </>
      )}
      {activeTab === 'recent'  && <RecentOrdersTab showToast={showToast} />}
      {activeTab === 'pending' && <PendingPaymentsTab showToast={showToast} onPendingCountChange={setPendingCount} />}
      <BottomNav active={activeTab} onChange={handleTabChange} pendingCount={pendingCount} />
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {pendingTabSwitch && (
        <ConfirmModal
          title="Unsaved Changes"
          message="You have unsaved changes. Leaving will discard them."
          confirmLabel="Discard & Leave"
          onConfirm={confirmTabSwitch}
          onCancel={() => setPendingTabSwitch(null)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);