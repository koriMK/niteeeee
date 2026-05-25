import { ShoppingCart } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  loggedIn: boolean;
  onLogout: () => void;
  onLoginClick: () => void;
  userName?: string | null;
}

export default function Navbar({ cartCount, onCartClick, loggedIn, onLogout, onLoginClick, userName }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center h-20">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.jpg" alt="Nate Poultry Meat" className="h-12 w-12 rounded-full object-cover border-2 border-gray-200" />
            <span className="font-bold text-gray-900 text-lg">Nate Poultry Meat</span>
          </div>
          <nav className="hidden md:flex flex-1 justify-center items-center space-x-10">
            <a href="#home" className="text-gray-900 hover:text-black transition text-sm font-bold">Home</a>
            <a href="#services" className="text-gray-900 hover:text-black transition text-sm font-bold">Services</a>
            <a href="#products" className="text-gray-900 hover:text-black transition text-sm font-bold">Products</a>
            <a href="#howto" className="text-gray-900 hover:text-black transition text-sm font-bold">How It Works</a>
            <a href="#contact" className="text-gray-900 hover:text-black transition text-sm font-bold">Contact</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={onCartClick}
              className="relative px-8 py-5 rounded-full transition flex items-center gap-2 text-white font-semibold text-base"
              style={{ backgroundColor: '#8e9c78' }}
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#5a6b47' }}>
                  {cartCount}
                </span>
              )}
            </button>
            {loggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {userName && (
                  <span style={{ fontSize: '0.85rem', color: '#555', fontWeight: 500 }}>
                    {userName.startsWith('+') ? userName.slice(0, 8) + '...' : userName.split(' ')[0]}
                  </span>
                )}
                <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Logout</button>
              </div>
            ) : (
              <button onClick={onLoginClick} style={{ background: 'none', border: '1.5px solid #8e9c78', color: '#8e9c78', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '6px 16px', borderRadius: '20px' }}>
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
