import { useEffect, useRef, useState } from 'react';

const collageImages = [
  '/assets/chicken.jpg',
  '/assets/eggs.jpg',
  '/assets/chevon.jpg',
  '/assets/Hero.jpg',
  '/assets/beef.jpg',
  '/assets/pork.jpg',
  '/assets/chicken.jpg',
];

const desktopStyles = [
  { gridColumn: '1', gridRow: '1' },
  { gridColumn: '1', gridRow: '2' },
  { gridColumn: '2', gridRow: '1 / 3' },
  { gridColumn: '3', gridRow: '1 / 3' },
  { gridColumn: '4', gridRow: '1' },
  { gridColumn: '4', gridRow: '2' },
  { gridColumn: '5', gridRow: '1 / 3' },
];

const stats = [
  { value: 'All',  label: 'Active in Nairobi' },
  { value: '50+',  label: 'Happy customers' },
  { value: '1K+',  label: 'Orders delivered' },
  { value: '100%', label: 'Fresh daily' },
];

export default function Hero() {
  const [activeDot, setActiveDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const directionRef = useRef(1);

  // Auto-slide every 3 seconds on mobile, reverse at ends
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const interval = setInterval(() => {
      setActiveDot(prev => {
        const next = prev + directionRef.current;
        if (next >= collageImages.length - 1) directionRef.current = -1;
        if (next <= 0) directionRef.current = 1;
        const items = container.querySelectorAll<HTMLElement>('.scroll-item');
        const target = items[next];
        if (target) container.scrollLeft = target.offsetLeft - container.offsetLeft;
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync dot on manual swipe
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const items = container.querySelectorAll('.scroll-item');
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = Array.from(items).indexOf(entry.target as Element);
            if (index !== -1) setActiveDot(index);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    items.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section id="home" style={{ backgroundColor: '#f5ede8', padding: 'clamp(32px, 6vw, 80px) 0 0', overflowX: 'hidden' }}>

        {/* Zone 1 — Text Block */}
        <div style={{ textAlign: 'center', padding: '0 clamp(16px, 5vw, 40px)', marginBottom: 'clamp(28px, 5vw, 56px)' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5.5vw, 2.6rem)', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.25, margin: '0 auto', maxWidth: '700px' }}>
            Fresh Meat Delivered<br />to Your Door
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#555', fontWeight: 400, marginTop: '12px' }}>
            Seamless supply chain management
          </p>
          <a
            href="#products"
            className="hero-cta"
            style={{ display: 'inline-block', marginTop: '20px', backgroundColor: '#e8514a', color: '#fff', fontWeight: 500, fontSize: '1rem', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.2s', minHeight: '44px', lineHeight: '20px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#d4433c')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#e8514a')}
          >
            Know more
          </a>
        </div>

        {/* Zone 2 — Desktop Grid */}
        <div className="collage-grid" style={{ gridTemplateColumns: '1fr 1.2fr 1.8fr 1.2fr 1fr', gridTemplateRows: '180px 180px', gap: '8px', padding: '0 48px', overflow: 'hidden' }}>
          {collageImages.map((src, i) => (
            <div key={i} style={{ ...desktopStyles[i], overflow: 'hidden', borderRadius: '10px' }}>
              <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>

        {/* Zone 2 — Mobile Scroll Carousel */}
        <div
          ref={scrollRef}
          className="collage-scroll"
          style={{ overflowX: 'auto', gap: '12px', padding: '0 20px 16px', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', scrollBehavior: 'smooth' }}
        >
          {collageImages.map((src, i) => (
            <div key={i} className="scroll-item" style={{ flexShrink: 0, width: '72vw', maxWidth: '280px', height: '200px', borderRadius: '10px', overflow: 'hidden', scrollSnapAlign: 'start' }}>
              <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>

        {/* Dots — mobile only */}
        <div className="dots-bar" style={{ justifyContent: 'center', gap: '6px', paddingBottom: '20px' }}>
          {collageImages.map((_, i) => (
            <div key={i} style={{ height: '8px', borderRadius: '999px', backgroundColor: activeDot === i ? '#1a1a1a' : '#ccc', width: activeDot === i ? '20px' : '8px', transition: 'width 0.3s ease, background 0.3s ease' }} />
          ))}
        </div>

      </section>

      {/* Stats Bar */}
      <div style={{ backgroundColor: '#fff', borderTop: '1px solid #eee' }}>
        <div className="stats-bar" style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px, 4vw, 36px) 24px' }}>
          {stats.map((stat, i) => (
            <div key={i} className="stat-item" style={{ textAlign: 'center', padding: '0 clamp(12px, 3vw, 32px)' }}>
              <div style={{ fontSize: 'clamp(1.4rem, 5vw, 2.2rem)', fontWeight: 700, color: '#e8514a', lineHeight: 1.1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.85rem', color: '#333', fontWeight: 400, marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        body { overflow-x: hidden; }

        .collage-grid { display: grid; }
        .collage-scroll { display: none; }
        .dots-bar { display: none; }

        .stats-bar {
          display: flex;
          justify-content: space-around;
          align-items: center;
        }

        @media (max-width: 768px) {
          .collage-grid { display: none !important; }
          .collage-scroll { display: flex !important; }
          .dots-bar { display: flex !important; }
          .hero-cta { width: calc(100% - 40px); max-width: 320px; text-align: center; }

          .stats-bar {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            padding: 24px 16px !important;
          }
          .stat-item:nth-child(1),
          .stat-item:nth-child(2) {
            border-bottom: 1px solid #eee;
            padding-bottom: 16px;
          }
          .stat-item:nth-child(3),
          .stat-item:nth-child(4) {
            padding-top: 16px;
          }
        }

        @media (min-width: 769px) {
          .collage-grid { display: grid !important; }
          .collage-scroll { display: none !important; }
          .dots-bar { display: none !important; }
        }

        .collage-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
