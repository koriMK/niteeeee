import { useState, useEffect, useRef } from 'react';
import { initiateSTKPush, checkPaymentStatus, createOrder, getAppConfig } from '../services/api';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface CartProps {
  cart: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemove: (id: number) => void;
  onClearCart: () => void;
}

function buildWaMessage(cart: CartItem[], total: number, waNumber: string) {
  const lines = cart.map(i => `- ${i.name} x${i.quantity} — KSh ${i.price * i.quantity}`).join('\n');
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi, I would like to place an order:\n\n${lines}\n\n*Total: KSh ${total}*\n\nPlease confirm my order. Thank you!`)}`;
}

const phones = [
  { display: '0794 187 716', href: 'tel:+254794187716' },
  { display: '0720 736 220', href: 'tel:+254720736220' },
  { display: '0790 897 788', href: 'tel:+254790897788' },
];

type CheckoutStep = 'cart' | 'checkout' | 'stk_sent' | 'success';

export default function Cart({ cart, onClose, onUpdateQuantity, onRemove, onClearCart }: CartProps) {
  const [showCall, setShowCall] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkoutId, setCheckoutId] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [waNumber, setWaNumber] = useState('254792125943');
  const callRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAppConfig().then(cfg => setWaNumber(cfg.whatsapp_number));
  }, []);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (callRef.current && !callRef.current.contains(e.target as Node)) setShowCall(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (step !== 'stk_sent' || !checkoutId) return;
    setTimeLeft(60);
    setPaymentStatus('pending');

    const poll = setInterval(async () => {
      try {
        const res = await checkPaymentStatus(checkoutId);
        if (res.status === 'completed') {
          clearInterval(poll);
          setStep('success');
          onClearCart();
        } else if (res.status === 'failed') {
          clearInterval(poll);
          setPaymentStatus('failed');
          setError('Payment was cancelled or failed. Please try again.');
          setStep('checkout');
        }
      } catch { /* keep polling */ }
    }, 3000);

    const countdown = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(countdown); clearInterval(poll); if (paymentStatus === 'pending') { setError('Payment request expired. Please try again.'); setStep('checkout'); } return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { clearInterval(poll); clearInterval(countdown); };
  }, [step, checkoutId]);

  const handleSTKPush = async () => {
    if (!phone || phone.length < 9) { setError('Enter a valid phone number'); return; }
    setError('');
    setLoading(true);
    try {
      // 1. Create a pending order in the database
      const orderItems = cart.map(item => ({ product_id: item.id, quantity: item.quantity }));
      const order = await createOrder(
        orderItems,
        deliveryAddress.trim() || undefined,
        null,        // vendor_id (optional, backend accepts null)
      ) as { id: number };

      // 2. Initiate STK push linked to the order
      const res = await initiateSTKPush(phone, total, order.id) as { checkout_request_id: string };
      setCheckoutId(res.checkout_request_id);
      setStep('stk_sent');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />

      <div style={{ position: 'relative', zIndex: 1, backgroundColor: '#fff', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease' }} className="cart-sheet">

        {/* Header */}
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {step !== 'cart' && (
                <button onClick={() => { setStep('cart'); setError(''); }}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#555' }}>←</button>
              )}
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1a1a1a', margin: 0 }}>
                  {step === 'cart' ? 'Your Order' : step === 'checkout' ? 'Checkout' : step === 'stk_sent' ? 'Check Your Phone' : 'Payment Done!'}
                </h2>
                <p style={{ color: '#888', fontSize: '0.85rem', margin: '2px 0 0' }}>{count} {count === 1 ? 'item' : 'items'}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#555' }}>✕</button>
          </div>
        </div>

        {/* ── STEP: CART ── */}
        {step === 'cart' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {cart.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>Your cart is empty</p>
              ) : (
                cart.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < cart.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#8e9c78', marginTop: '2px' }}>KSh {(item.price * item.quantity).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => item.quantity <= 1 ? onRemove(item.id) : onUpdateQuantity(item.id, item.quantity - 1)}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #ccc', background: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>−</button>
                      <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #ccc', background: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ padding: '16px 20px 24px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontWeight: 500, color: '#555' }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#8e9c78' }}>KSh {total.toLocaleString()}</span>
                </div>

                {/* Pay via M-Pesa STK Push */}
                <button onClick={() => setStep('checkout')}
                  style={{ width: '100%', backgroundColor: '#8e9c78', color: '#fff', fontWeight: 700, fontSize: '1rem', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '10px' }}>
                  📱 Pay via M-Pesa
                </button>

                {/* WhatsApp Order */}
                <a href={buildWaMessage(cart, total, waNumber)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: '#25D366', color: '#fff', fontWeight: 600, fontSize: '1rem', padding: '14px', borderRadius: '10px', textDecoration: 'none', marginBottom: '10px', boxSizing: 'border-box' }}>
                  🛒 Order via WhatsApp
                </a>

                {/* Call to Order */}
                <div ref={callRef} style={{ position: 'relative' }}>
                  <button onClick={() => setShowCall(p => !p)}
                    style={{ width: '100%', backgroundColor: '#1a1a1a', color: '#fff', fontWeight: 600, fontSize: '1rem', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
                    📞 Call to Order
                  </button>
                  {showCall && (
                    <div style={{ position: 'absolute', bottom: '110%', left: 0, right: 0, backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 10 }}>
                      {phones.map(p => (
                        <a key={p.href} href={p.href}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', textDecoration: 'none', color: '#1a1a1a', fontWeight: 500 }}>
                          <span>📞 {p.display}</span>
                          <span style={{ color: '#8e9c78' }}>→</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP: CHECKOUT (enter phone + address) ── */}
        {step === 'checkout' && (
          <div style={{ flex: 1, padding: '24px 20px', overflowY: 'auto' }}>
            <div style={{ backgroundColor: '#f9f7f4', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px', color: '#1a1a1a' }}>Order Summary</p>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#555', marginBottom: '4px' }}>
                  <span>{item.name} x{item.quantity}</span>
                  <span>KSh {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#8e9c78', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <span>Total</span>
                <span>KSh {total.toLocaleString()}</span>
              </div>
            </div>

            <p style={{ fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Delivery Address</p>
            <textarea
              placeholder="e.g. Kimathi Street, Nairobi"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #ddd', fontSize: '15px', marginBottom: '16px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
            />

            <p style={{ fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>M-Pesa Phone Number</p>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '12px' }}>You will receive an STK Push prompt on this number</p>

            <input
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1.5px solid #ddd', fontSize: '16px', marginBottom: '12px', boxSizing: 'border-box', outline: 'none' }}
            />

            {error && <p style={{ color: '#e8514a', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

            <button onClick={handleSTKPush} disabled={loading}
              style={{ width: '100%', backgroundColor: '#8e9c78', color: '#fff', fontWeight: 700, fontSize: '1rem', padding: '14px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Placing order...' : `📱 Pay KSh ${total.toLocaleString()} via M-Pesa`}
            </button>

            <p style={{ fontSize: '0.8rem', color: '#aaa', textAlign: 'center', marginTop: '12px' }}>
              Powered by Safaricom M-Pesa
            </p>
          </div>
        )}

        {/* ── STEP: STK SENT ── */}
        {step === 'stk_sent' && (
          <div style={{ flex: 1, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📱</div>
            <h3 style={{ fontWeight: 700, fontSize: '1.3rem', color: '#1a1a1a', marginBottom: '8px' }}>Check Your Phone!</h3>
            <p style={{ color: '#555', marginBottom: '8px' }}>An M-Pesa payment request of</p>
            <p style={{ fontWeight: 700, fontSize: '1.8rem', color: '#8e9c78', marginBottom: '8px' }}>KSh {total.toLocaleString()}</p>
            <p style={{ color: '#555', marginBottom: '24px' }}>has been sent to <strong>{phone}</strong></p>

            <div style={{ backgroundColor: '#f9f7f4', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>Steps:</p>
              {['A prompt will appear on your phone', 'Enter your M-Pesa PIN', 'Confirm the payment', 'You will receive an SMS confirmation'].map((s, i) => (
                <p key={i} style={{ margin: '4px 0', color: '#555', fontSize: '0.9rem' }}>{i + 1}. {s}</p>
              ))}
            </div>

            <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '8px' }}>
              Ref: {checkoutId}
            </p>
            <p style={{ fontSize: '0.85rem', color: timeLeft <= 10 ? '#e8514a' : '#aaa', marginBottom: '16px' }}>
              ⏱ Expires in {timeLeft}s
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px', color: '#888', fontSize: '0.9rem' }}>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #8e9c78', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Waiting for payment confirmation...
            </div>

            <button onClick={() => setStep('checkout')}
              style={{ width: '100%', backgroundColor: 'transparent', color: '#888', fontWeight: 500, fontSize: '0.9rem', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', cursor: 'pointer' }}>
              Didn't receive it? Try again
            </button>
          </div>
        )}

        {/* ── STEP: SUCCESS ── */}
        {step === 'success' && (
          <div style={{ flex: 1, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
            <h3 style={{ fontWeight: 700, fontSize: '1.3rem', color: '#1a1a1a', marginBottom: '8px' }}>Order Placed!</h3>
            <p style={{ color: '#555', marginBottom: '24px' }}>Thank you for your order. We'll prepare it right away!</p>
            <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi, I just paid KSh ${total} via M-Pesa for my order. Ref: ${checkoutId}. Please confirm.`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', backgroundColor: '#25D366', color: '#fff', fontWeight: 600, padding: '14px', borderRadius: '10px', textDecoration: 'none', marginBottom: '10px' }}>
              📲 Send Confirmation on WhatsApp
            </a>
            <button onClick={onClose}
              style={{ width: '100%', backgroundColor: '#8e9c78', color: '#fff', fontWeight: 600, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
              Done
            </button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .cart-sheet { width: 100%; max-width: 420px; height: 100vh; border-radius: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          @keyframes slideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .cart-sheet { max-width: 100% !important; width: 100% !important; height: 85vh !important; border-radius: 16px 16px 0 0 !important; }
        }
      `}</style>
    </div>
  );
}
