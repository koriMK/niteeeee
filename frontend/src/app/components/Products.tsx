import { useState, useEffect } from 'react';
import { fetchProducts, type BackendProduct } from '../services/api';

const CATEGORY_CONFIGS: Record<string, { badge: string; image: string }> = {
  'Fresh Eggs': {
    badge: '#e8514a',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600',
  },
  'Fresh Chicken': {
    badge: '#8e9c78',
    image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600',
  },
  'Beef': {
    badge: '#c0392b',
    image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600',
  },
  'Pork': {
    badge: '#e67e22',
    image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600',
  },
  'Chevon / Goat Meat': {
    badge: '#7f8c8d',
    image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600',
  },
};

const DEFAULT_CONFIG = {
  badge: '#8e9c78',
  image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600',
};

interface DisplayItem {
  id: number;
  name: string;
  sub: string;
  price: number;
  image: string;
}

interface GroupedCategory {
  label: string;
  image: string;
  badge: string;
  items: DisplayItem[];
}

interface ProductsProps {
  quantities: Record<number, number>;
  onUpdateQuantity: (product: { id: number; name: string; price: number; unit: string; image: string }, quantity: number) => void;
}

export default function Products({ quantities, onUpdateQuantity }: ProductsProps) {
  const [categories, setCategories] = useState<GroupedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await fetchProducts();
        
        // Group by category
        const groups: Record<string, BackendProduct[]> = {};
        for (const item of data.items) {
          if (!groups[item.category]) {
            groups[item.category] = [];
          }
          groups[item.category].push(item);
        }

        const groupedList: GroupedCategory[] = Object.keys(groups).map(catName => {
          const config = CATEGORY_CONFIGS[catName] || DEFAULT_CONFIG;
          const items = groups[catName].map(item => ({
            id: item.id,
            name: item.name,
            sub: item.unit,
            price: item.price,
            image: item.image_urls[0] || config.image
          }));
          return {
            label: catName,
            image: config.image,
            badge: config.badge,
            items
          };
        });

        setCategories(groupedList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const increment = (item: DisplayItem) => {
    const currentQty = quantities[item.id] || 0;
    onUpdateQuantity({ id: item.id, name: item.name, price: item.price, unit: item.sub, image: item.image }, currentQty + 1);
  };

  const decrement = (item: DisplayItem) => {
    const currentQty = quantities[item.id] || 0;
    onUpdateQuantity({ id: item.id, name: item.name, price: item.price, unit: item.sub, image: item.image }, currentQty - 1);
  };

  return (
    <section id="products" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">Our Products</h2>
          <p className="text-xl text-gray-600">Fresh, quality meat delivered to your doorstep</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0' }}>
            <span style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid #8e9c78', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#666', fontWeight: 500 }}>Loading fresh products...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#e8514a', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }} className="products-grid">
            {categories.map(cat => (
              <div key={cat.label} style={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

                {/* Image banner */}
                <div style={{ position: 'relative', height: '160px' }}>
                  <img src={cat.image} alt={cat.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />
                  <span style={{ position: 'absolute', bottom: '10px', left: '12px', color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{cat.label}</span>
                  <span style={{ position: 'absolute', bottom: '10px', right: '12px', backgroundColor: cat.badge, color: '#fff', borderRadius: '20px', padding: '4px 12px', fontSize: '0.75rem' }}>
                    {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Product rows */}
                <div>
                  {cat.items.map((item, i) => {
                    const qty = quantities[item.id] || 0;
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < cat.items.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.95rem', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#8e9c78', marginTop: '2px' }}>
                            Ksh {item.price} <span style={{ fontWeight: 400, color: '#888', fontSize: '0.8rem' }}>/ {item.sub}</span>
                          </div>
                        </div>

                        {qty === 0 ? (
                          <button
                            onClick={() => increment(item)}
                            style={{ backgroundColor: cat.badge, color: '#fff', borderRadius: '20px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: '44px', whiteSpace: 'nowrap' }}
                          >
                            + Add
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: cat.badge, borderRadius: '20px', padding: '4px 8px', minHeight: '44px' }}>
                            <button onClick={() => decrement(item)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                            <button onClick={() => increment(item)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .products-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .products-grid { grid-template-columns: repeat(1, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
