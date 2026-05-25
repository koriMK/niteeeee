import { Check, X } from 'lucide-react';

export default function Comparison() {
  const rows = [
    { feature: 'Ultra-fresh cuts (daily)', us: true, butcher: true, super: false },
    { feature: 'Same-day delivery', us: true, butcher: false, super: false },
    { feature: 'Bulk discounts', us: true, butcher: false, super: true },
    { feature: 'Custom butchering', us: true, butcher: true, super: false },
    { feature: 'Quality guarantee', us: true, butcher: false, super: true },
    { feature: 'Wholesale pricing', us: true, butcher: false, super: false },
    { feature: 'Online ordering & tracking', us: true, butcher: false, super: true },
  ];

  return (
    <section className="py-24 bg-[#f9f7f4]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">Why Choose Nate Poultry Meat?</h2>
          <p className="text-xl text-gray-600">Fresh, quality meat at the best prices in Nairobi</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-6 text-gray-600 font-medium">Features</th>
                <th className="p-6 text-center"><div className="font-bold text-lg text-gray-900">Nate Poultry Meat</div></th>
                <th className="p-6 text-center"><div className="font-bold text-lg text-gray-600">Local Butcher</div></th>
                <th className="p-6 text-center"><div className="font-bold text-lg text-gray-600">Supermarket</div></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.feature} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-6 font-medium text-gray-900">{row.feature}</td>
                  <td className="p-6 text-center"><Check className="w-5 h-5 text-green-600 mx-auto" /></td>
                  <td className="p-6 text-center">{row.butcher ? <Check className="w-5 h-5 text-gray-400 mx-auto" /> : <X className="w-5 h-5 text-gray-400 mx-auto" />}</td>
                  <td className="p-6 text-center">{row.super ? <Check className="w-5 h-5 text-gray-400 mx-auto" /> : <X className="w-5 h-5 text-gray-400 mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
