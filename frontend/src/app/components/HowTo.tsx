import { ShoppingCart, Phone, Truck } from 'lucide-react';

export default function HowTo() {
  return (
    <section id="howto" className="py-24 bg-[#f9f7f4]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">Get Started</h2>
          <p className="text-xl text-gray-600">Three simple steps to premium meat delivery</p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {[
            { num: '1', Icon: ShoppingCart, title: 'Browse & Select', desc: 'Browse our extensive catalog of premium cuts. Filter by type, grade, or special offers. Add items to your cart with just a click.' },
            { num: '2', Icon: Phone, title: 'Customize Your Order', desc: 'Choose quantities, specify custom cuts, select packaging preferences, and pick your delivery time slot. Pay securely via M-PESA Till: 5247893' },
            { num: '3', Icon: Truck, title: 'Order Delivered Fresh', desc: 'Track your order in real-time. Receive fresh, refrigerated meat at your doorstep, on schedule. Quality guaranteed or your money back.' },
          ].map(step => (
            <div key={step.num} className="text-center">
              <div className="relative mb-8">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: '#8e9c78' }}>
                  <step.Icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-3 -right-3 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {step.num}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{step.title}</h3>
              <p className="text-gray-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <a href="tel:+254790897788" className="inline-block px-14 py-5 rounded-full text-lg font-semibold text-white transition" style={{ backgroundColor: '#8e9c78' }}>
            Call Now: +254 790 897 788
          </a>
        </div>
      </div>
    </section>
  );
}
