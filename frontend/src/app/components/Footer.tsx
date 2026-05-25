import { Phone, MapPin, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="contact" className="bg-gray-900 text-white py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <h3 className="text-xl font-bold mb-4">Nate Poultry Meat</h3>
            <p className="text-gray-400 leading-relaxed">Your trusted partner for premium quality meat. Fresh cuts delivered daily across Nairobi.</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-gray-300">Services</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-white transition">Retail Orders</a></li>
              <li><a href="#" className="hover:text-white transition">Wholesale Supply</a></li>
              <li><a href="#" className="hover:text-white transition">Custom Butchering</a></li>
              <li><a href="#" className="hover:text-white transition">Bulk Catering</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-gray-300">Resources</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-white transition">Cooking Guides</a></li>
              <li><a href="#" className="hover:text-white transition">Storage Tips</a></li>
              <li><a href="#" className="hover:text-white transition">Quality Standards</a></li>
              <li><a href="#" className="hover:text-white transition">FAQs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-gray-300">Contact</h4>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-center gap-2"><Phone className="w-3 h-3" /><span>0794 187 716</span></li>
              <li className="flex items-center gap-2"><Phone className="w-3 h-3" /><span>0720 736 220</span></li>
              <li className="flex items-center gap-2"><Phone className="w-3 h-3" /><span>0790 897 788</span></li>
              <li className="flex items-center gap-2"><MapPin className="w-3 h-3" /><span>Nairobi, Kenya</span></li>
              <li className="flex items-center gap-2"><Clock className="w-3 h-3" /><span>Mon-Sat: 7AM-8PM</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">© 2026 Nate Poultry Meat. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition">Privacy Policy</a>
              <a href="#" className="hover:text-white transition">Terms of Service</a>
              <a href="#" className="hover:text-white transition">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
