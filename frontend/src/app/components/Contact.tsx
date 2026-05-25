import { useState, useEffect } from 'react';
import { getAppConfig } from '../services/api';

const phones = [
  { display: '0794 187 716', href: 'tel:+254794187716' },
  { display: '0720 736 220', href: 'tel:+254720736220' },
  { display: '0790 897 788', href: 'tel:+254790897788' },
];

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function Contact() {
  const [waNumber, setWaNumber] = useState('254792125943');

  useEffect(() => {
    getAppConfig().then(cfg => setWaNumber(cfg.whatsapp_number));
  }, []);

  const waLink = `https://wa.me/${waNumber}?text=Hi%2C%20I%20would%20like%20to%20place%20an%20order`;

  const formatDisplayPhone = (raw: string) => {
    if (raw.startsWith('254')) {
      const main = raw.slice(3);
      return '0' + main.slice(0, 3) + ' ' + main.slice(3, 6) + ' ' + main.slice(6);
    }
    return raw;
  };

  return (
    <>
      <section id="contact" className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Get in Touch</h2>
            <p className="text-gray-600">Call us or order directly via WhatsApp</p>
          </div>

          {/* Call buttons */}
          <div className="flex flex-col gap-3 mb-4">
            {phones.map(p => (
              <a
                key={p.href}
                href={p.href}
                className="flex items-center gap-3 w-full text-white font-semibold rounded-xl px-6 justify-center"
                style={{ backgroundColor: '#8e9c78', minHeight: '52px', fontSize: '16px', textDecoration: 'none' }}
              >
                <span>📞</span>
                <span>{p.display}</span>
              </a>
            ))}
          </div>

          {/* WhatsApp button */}
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full font-semibold rounded-xl px-6 text-white"
            style={{ backgroundColor: '#25D366', minHeight: '56px', fontSize: '16px', borderRadius: '8px', textDecoration: 'none' }}
          >
            <WhatsAppIcon />
            <div>
              <div>Order via WhatsApp</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>{formatDisplayPhone(waNumber)}</div>
            </div>
          </a>
        </div>
      </section>

      {/* Floating WhatsApp button */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'transform 0.2s, background 0.2s',
          textDecoration: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.backgroundColor = '#1ebe5d'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#25D366'; }}
      >
        <WhatsAppIcon />
      </a>
    </>
  );
}
