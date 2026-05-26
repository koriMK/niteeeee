import { useState, useRef, useEffect } from 'react';
import { checkPhone, createAccount, loginWithPin, forgotPin, updateProfile, getAppConfig, AuthUser, fetchCurrentUser } from '../services/api';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

type Screen = 'phone' | 'create_pin' | 'enter_pin' | 'set_name';
const WEAK = new Set(['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','1212','0123','9876']);

function PinInput({ value, onChange, onComplete, label, disabled = false }: {
  value: string; onChange: (v: string) => void;
  onComplete?: (v: string) => void; label?: string; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!disabled) setTimeout(() => ref.current?.focus(), 150); }, [disabled]);

  return (
    <div style={{ marginBottom: '20px' }}>
      {label && <p style={{ fontSize: '0.88rem', color: disabled ? '#bbb' : '#555', marginBottom: '10px', fontWeight: 600 }}>{label}</p>}
      <input
        ref={ref}
        type="tel" inputMode="numeric" maxLength={4}
        value={value} disabled={disabled}
        autoComplete="one-time-code"
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
          onChange(raw);
          if (raw.length === 4 && onComplete) setTimeout(() => onComplete(raw), 60);
        }}
        style={{ position: 'fixed', top: '-999px', left: '-999px', opacity: 0.01, fontSize: '16px' }}
      />
      <div
        style={{ display: 'flex', gap: '12px', justifyContent: 'center', cursor: disabled ? 'default' : 'text', opacity: disabled ? 0.35 : 1 }}
        onClick={() => !disabled && ref.current?.focus()}
      >
        {[0,1,2,3].map(i => {
          const digit = value[i] || '';
          const active = !disabled && i === value.length && value.length < 4;
          return (
            <div key={i} style={{
              width: '60px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 700, borderRadius: '12px',
              border: `2px solid ${active ? '#8e9c78' : digit ? '#8e9c78' : '#ddd'}`,
              backgroundColor: digit ? '#f0f4ec' : '#fafafa',
              boxShadow: active ? '0 0 0 3px rgba(142,156,120,0.2)' : 'none',
              transition: 'all 0.15s',
            }}>
              {digit ? '●' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [screen, setScreen] = useState<Screen>('phone');
  const [phone, setPhone] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [pinReady, setPinReady] = useState(false);
  const [waNumber, setWaNumber] = useState('254792125943');
  const phoneRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAppConfig().then(cfg => setWaNumber(cfg.whatsapp_number));
  }, []);

  useEffect(() => {
    if (screen === 'phone') setTimeout(() => phoneRef.current?.focus(), 100);
    if (screen === 'create_pin' || screen === 'enter_pin') { setPin(''); setConfirmPin(''); setPinReady(false); }
  }, [screen]);

  const shake_ = () => { setShake(true); setTimeout(() => setShake(false), 500); };
  const fmt = (p: string) => p.replace('+254', '+254 ').replace(/(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');

  const handleContinue = async () => {
    setError('');
    if (!phone) { setError('Enter your phone number'); return; }
    setLoading(true);
    try {
      const res = await checkPhone(phone);
      setDisplayPhone(res.phone); setPhone(res.phone);
      if (res.exists) { setUserName(res.name); setScreen('enter_pin'); }
      else setScreen('create_pin');
    } catch (e: unknown) { setError(e instanceof Error ? e.message.replace(/[\r\n]/g, '') : 'Error'); }
    finally { setLoading(false); }
  };

  const handlePinDone = (val: string) => {
    if (WEAK.has(val) || new Set(val).size === 1) {
      setError('PIN too simple. Try a different combination.'); setPin(''); return;
    }
    setError(''); setPinReady(true);
    setTimeout(() => confirmRef.current?.focus(), 150);
  };

  const handleConfirmDone = (val: string) => {
    if (val !== pin) { setError('PINs do not match'); shake_(); setConfirmPin(''); return; }
    setError(''); handleCreate(pin);
  };

  const handleCreate = async (pinVal: string) => {
    setLoading(true);
    try {
      const res = await createAccount(phone, pinVal, name || undefined);
      if (!name) { setScreen('set_name'); return; }
      onSuccess(res.user);
    } catch (e: unknown) { setError(e instanceof Error ? e.message.replace(/[\r\n]/g, '') : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleLogin = async (pinVal?: string) => {
    const p = pinVal || pin;
    if (p.length !== 4) return;
    setError(''); setLoading(true);
    const sanitizedPhone = phone.replace(/[^\d+]/g, '');
    try {
      const res = await loginWithPin(sanitizedPhone, p);
      onSuccess(res.user);
    } catch {
      setError('Invalid PIN or account not found.');
      shake_(); setPin('');
    } finally { setLoading(false); }
  };

  const handleSetName = async () => {
    if (name.trim()) {
      const updatedUser = await updateProfile(name.trim());
      onSuccess(updatedUser);
    } else {
      // User chose to skip — fetch current profile from the token already set during create
      const user = await fetchCurrentUser();
      onSuccess(user);
    }
  };

  const btn = (disabled?: boolean): React.CSSProperties => ({
    width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
    backgroundColor: '#8e9c78', color: '#fff', fontWeight: 700, fontSize: '1rem',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit', marginTop: '4px',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '32px 24px 48px', width: '100%', maxWidth: '480px', animation: 'slideUp 0.3s ease' }}
        onClick={e => e.stopPropagation()}>

        {/* PHONE */}
        {screen === 'phone' && <>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <img src="/assets/logo.jpg" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px', border: '2px solid #eee' }} />
            <h2 style={{ fontWeight: 800, fontSize: '1.5rem', margin: '0 0 4px' }}>Welcome to Nate Poultry</h2>
            <p style={{ color: '#888', fontSize: '0.95rem', margin: 0 }}>Enter your phone number to continue</p>
          </div>
          <div style={{ display: 'flex', border: '2px solid #ddd', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#f5f5f5', padding: '14px 12px', borderRight: '2px solid #ddd', color: '#555', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              🇰🇪 +254
            </div>
            <input ref={phoneRef} type="tel" inputMode="numeric" placeholder="7XX XXX XXX"
              value={phone.replace(/^\+?254/, '').replace(/^0/, '')}
              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPhone(v ? `+254${v}` : ''); }}
              onKeyDown={e => e.key === 'Enter' && handleContinue()}
              style={{ flex: 1, padding: '14px', border: 'none', outline: 'none', fontSize: '16px', fontFamily: 'inherit' }} />
          </div>
          {error && <p style={{ color: '#e8514a', fontSize: '0.88rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button onClick={handleContinue} disabled={loading} style={btn(loading)}>
            {loading ? '⏳ Checking...' : 'Continue →'}
          </button>
        </>}

        {/* CREATE PIN */}
        {screen === 'create_pin' && <>
          <button onClick={() => { setScreen('phone'); setError(''); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '12px', padding: 0 }}>← Back</button>
          <h2 style={{ fontWeight: 800, fontSize: '1.4rem', margin: '0 0 4px' }}>Create your PIN</h2>
          <p style={{ color: '#8e9c78', fontWeight: 600, marginBottom: '24px' }}>{fmt(displayPhone)}</p>
          <div style={{ animation: shake ? 'shake 0.5s ease' : 'none' }}>
            <PinInput value={pin} onChange={v => { setPin(v); if (v.length < 4) { setPinReady(false); setConfirmPin(''); } }} onComplete={handlePinDone} label="Enter PIN" />
            <PinInput value={confirmPin} onChange={setConfirmPin} onComplete={handleConfirmDone} label="Confirm PIN" disabled={!pinReady} />
          </div>
          {error && <p style={{ color: '#e8514a', fontSize: '0.88rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button onClick={() => handleCreate(pin)} disabled={loading || pin.length !== 4 || confirmPin.length !== 4} style={btn(loading || pin.length !== 4 || confirmPin.length !== 4)}>
            {loading ? '⏳ Creating account...' : 'Create Account'}
          </button>
          <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.82rem', marginTop: '14px' }}>🔒 Never share your PIN with anyone</p>
        </>}

        {/* ENTER PIN */}
        {screen === 'enter_pin' && <>
          <button onClick={() => { setScreen('phone'); setError(''); setPin(''); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '12px', padding: 0 }}>← Change number</button>
          <h2 style={{ fontWeight: 800, fontSize: '1.4rem', margin: '0 0 4px' }}>
            {userName ? `Welcome back, ${userName.split(' ')[0]}! 👋` : 'Welcome back! 👋'}
          </h2>
          <p style={{ color: '#8e9c78', fontWeight: 600, marginBottom: '24px' }}>{fmt(displayPhone)}</p>
          <div style={{ animation: shake ? 'shake 0.5s ease' : 'none' }}>
            <PinInput value={pin} onChange={setPin} onComplete={handleLogin} label="Enter your PIN" />
          </div>
          {error && <p style={{ color: '#e8514a', fontSize: '0.88rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button onClick={() => handleLogin()} disabled={loading || pin.length !== 4} style={btn(loading || pin.length !== 4)}>
            {loading ? '⏳ Verifying...' : 'Login'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.88rem', color: '#aaa', marginTop: '14px' }}>
            Forgot PIN?{' '}
            <button onClick={async () => { try { const r = await forgotPin(phone); window.open(r.wa_link, '_blank'); } catch { window.open(`https://wa.me/${waNumber}`, '_blank'); } }}
              style={{ background: 'none', border: 'none', color: '#8e9c78', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
              Contact us on WhatsApp
            </button>
          </p>
        </>}

        {/* SET NAME */}
        {screen === 'set_name' && <>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
            <h2 style={{ fontWeight: 800, fontSize: '1.4rem', margin: '0 0 4px' }}>Account created!</h2>
            <p style={{ color: '#888' }}>What should we call you? (optional)</p>
          </div>
          <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSetName()} autoFocus
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #ddd', fontSize: '16px', marginBottom: '16px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={handleSetName} style={btn()}>{name ? 'Save & Continue' : 'Skip'}</button>
        </>}

      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </div>
  );
}
