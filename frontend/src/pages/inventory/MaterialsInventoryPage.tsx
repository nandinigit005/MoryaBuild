import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react';
import { formatFullINR, formatINR } from '../../services/storage';
import { createMaterial, createMovement, deleteMaterial as deleteMaterialApi, fetchInventory, updateMaterial } from '../../services/operationsApi';

type MaterialCategory = 'Cement' | 'Steel' | 'Aggregates' | 'Bricks & Blocks' | 'Electrical' | 'Plumbing' | 'Other';
type MovementType = 'STOCK_IN' | 'CONSUMPTION';

interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  quantity: number;
  minimumStock: number;
  unitPrice: number;
  supplier: string;
}

interface StockMovement {
  id: string;
  materialId: string;
  type: MovementType;
  quantity: number;
  date: string;
  note: string;
}

interface MaterialFormData {
  name: string;
  category: MaterialCategory;
  unit: string;
  quantity: string;
  minimumStock: string;
  unitPrice: string;
  supplier: string;
}

interface MovementFormData {
  materialId: string;
  type: MovementType;
  quantity: string;
  date: string;
  note: string;
}

const categories: MaterialCategory[] = ['Cement', 'Steel', 'Aggregates', 'Bricks & Blocks', 'Electrical', 'Plumbing', 'Other'];

const today = () => new Date().toISOString().split('T')[0];

const emptyMaterialForm = (): MaterialFormData => ({
  name: '',
  category: 'Cement',
  unit: 'bags',
  quantity: '',
  minimumStock: '',
  unitPrice: '',
  supplier: '',
});

const emptyMovementForm = (materialId = ''): MovementFormData => ({
  materialId,
  type: 'STOCK_IN',
  quantity: '',
  date: today(),
  note: '',
});

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

export const MaterialsInventoryPage: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [materialForm, setMaterialForm] = useState<MaterialFormData>(emptyMaterialForm());
  const [movementForm, setMovementForm] = useState<MovementFormData>(emptyMovementForm());
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState('');
  const [movementError, setMovementError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchInventory().then(({ materials: records, movements: movementRecords }) => {
      const nextMaterials = records.map((m) => ({ id: m.id, name: m.name, category: (categories.includes(m.category as MaterialCategory) ? m.category : 'Other') as MaterialCategory, unit: m.unit, quantity: m.currentStock, minimumStock: m.minimumThreshold, unitPrice: m.unitPrice, supplier: m.supplier?.name || '' }));
      setMaterials(nextMaterials);
      setMovements(movementRecords.map((m) => ({ id: m.id, materialId: m.materialId, type: m.movementType === 'PURCHASE_RECEIPT' ? 'STOCK_IN' : 'CONSUMPTION', quantity: m.quantity, date: m.createdAt.slice(0, 10), note: m.notes || '' })));
      setMovementForm(emptyMovementForm(nextMaterials[0]?.id || ''));
    }).catch((error: Error) => setLoadError(error.message)).finally(() => setLoading(false));
  }, []);

  const materialNames = useMemo(() => new Map(materials.map((material) => [material.id, material.name])), [materials]);
  const lowStockMaterials = materials.filter((material) => material.quantity <= material.minimumStock);
  const inventoryValue = materials.reduce((sum, material) => sum + material.quantity * material.unitPrice, 0);
  const stockInCount = movements.filter((movement) => movement.type === 'STOCK_IN').length;
  const consumptionCount = movements.filter((movement) => movement.type === 'CONSUMPTION').length;

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = [material.name, material.supplier, material.category]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesSearch && (categoryFilter === 'ALL' || material.category === categoryFilter);
  });

  const updateMaterialForm = (name: keyof MaterialFormData, value: string) => {
    setMaterialForm((current) => ({ ...current, [name]: value }));
    setMaterialError('');
  };

  const updateMovementForm = (name: keyof MovementFormData, value: string) => {
    setMovementForm((current) => ({ ...current, [name]: value }));
    setMovementError('');
  };

  const handleMaterialSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(materialForm.quantity);
    const minimumStock = Number(materialForm.minimumStock);
    const unitPrice = Number(materialForm.unitPrice);
    if (!materialForm.name.trim() || !materialForm.unit.trim() || !materialForm.supplier.trim()) {
      setMaterialError('Name, unit, and supplier are required.');
      return;
    }
    if (![quantity, minimumStock, unitPrice].every((value) => Number.isFinite(value) && value >= 0)) {
      setMaterialError('Quantity, minimum stock, and unit price must be zero or greater.');
      return;
    }

    let savedMaterial: Material;
    try {
      const payload = { code: editingMaterialId ? materials.find((item) => item.id === editingMaterialId)?.id || materialForm.name.trim().toUpperCase().replace(/\s+/g, '-') : materialForm.name.trim().toUpperCase().replace(/\s+/g, '-'), name: materialForm.name.trim(), category: materialForm.category, unit: materialForm.unit.trim(), currentStock: quantity, minimumThreshold: minimumStock, unitPrice, supplierId: null };
      const result = editingMaterialId ? await updateMaterial(editingMaterialId, payload) : await createMaterial(payload);
      const m = result.material;
      savedMaterial = { id: m.id, name: m.name, category: (categories.includes(m.category as MaterialCategory) ? m.category : 'Other') as MaterialCategory, unit: m.unit, quantity: m.currentStock, minimumStock: m.minimumThreshold, unitPrice: m.unitPrice, supplier: m.supplier?.name || '' };
      setMaterials((current) => editingMaterialId ? current.map((item) => item.id === savedMaterial.id ? savedMaterial : item) : [savedMaterial, ...current]);
    } catch (error) { setMaterialError((error as Error).message); return; }
    setMaterialForm(emptyMaterialForm());
    setEditingMaterialId(null);
    setMaterialError('');
    setMovementForm((current) => ({ ...current, materialId: current.materialId || savedMaterial.id }));
  };

  const handleMovementSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(movementForm.quantity);
    const material = materials.find((item) => item.id === movementForm.materialId);
    if (!material) {
      setMovementError('Select a material before recording movement.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMovementError('Movement quantity must be greater than zero.');
      return;
    }
    if (movementForm.type === 'CONSUMPTION' && quantity > material.quantity) {
      setMovementError(`Only ${material.quantity} ${material.unit} available for consumption.`);
      return;
    }
    try {
      await createMovement({ materialId: material.id, movementType: movementForm.type === 'STOCK_IN' ? 'PURCHASE_RECEIPT' : 'PROJECT_CONSUMPTION', quantity, unitPrice: material.unitPrice, referenceDoc: null, notes: movementForm.note.trim() || null });
      const refreshed = await fetchInventory();
      setMaterials(refreshed.materials.map((m) => ({ id: m.id, name: m.name, category: (categories.includes(m.category as MaterialCategory) ? m.category : 'Other') as MaterialCategory, unit: m.unit, quantity: m.currentStock, minimumStock: m.minimumThreshold, unitPrice: m.unitPrice, supplier: m.supplier?.name || '' })));
      setMovements(refreshed.movements.map((m) => ({ id: m.id, materialId: m.materialId, type: m.movementType === 'PURCHASE_RECEIPT' ? 'STOCK_IN' : 'CONSUMPTION', quantity: m.quantity, date: m.createdAt.slice(0, 10), note: m.notes || '' })));
    } catch (error) { setMovementError((error as Error).message); return; }
    setMovementForm(emptyMovementForm(material.id));
    setMovementError('');
  };

  const startEditing = (material: Material) => {
    setEditingMaterialId(material.id);
    setMaterialForm({ ...material, quantity: String(material.quantity), minimumStock: String(material.minimumStock), unitPrice: String(material.unitPrice) });
    setMaterialError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMaterial = async (material: Material) => {
    if (window.confirm(`Delete ${material.name}? Its movement history will also be removed.`)) {
      try { await deleteMaterialApi(material.id); } catch (error) { setMaterialError((error as Error).message); return; }
      setMaterials((current) => current.filter((item) => item.id !== material.id));
      setMovements((current) => current.filter((movement) => movement.materialId !== material.id));
      if (editingMaterialId === material.id) {
        setEditingMaterialId(null);
        setMaterialForm(emptyMaterialForm());
      }
      if (movementForm.materialId === material.id) setMovementForm(emptyMovementForm(materials.find((item) => item.id !== material.id)?.id || ''));
    }
  };

  const summaryCards = [
    { label: 'Inventory Value', value: formatINR(inventoryValue), icon: IndianRupee, color: 'text-blue-600 bg-blue-50' },
    { label: 'Material Records', value: String(materials.length), icon: Boxes, color: 'text-brand-600 bg-amber-50' },
    { label: 'Low-stock Alerts', value: String(lowStockMaterials.length), icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
    { label: 'Stock Movements', value: String(movements.length), icon: ClipboardList, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider"><Boxes className="w-3.5 h-3.5" /> Site materials control</div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Materials & Inventory</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track supplier stock, site consumption, and material availability in one register.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected to API</span>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading inventory…</p>}
      {loadError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Unable to load inventory: {loadError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div></div><p className="text-xl font-extrabold text-slate-900 mt-2.5 truncate">{value}</p></div>)}
      </div>

      {lowStockMaterials.length > 0 && <section className="bg-rose-50/80 border border-rose-200 rounded-xl p-5"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-rose-600" /><h3 className="text-xs font-bold text-rose-950 uppercase tracking-wide">Low-stock alerts</h3></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{lowStockMaterials.map((material) => <div key={material.id} className="flex items-center justify-between gap-3 bg-white/70 border border-rose-100 rounded-lg px-3 py-2.5 text-xs"><div><strong className="text-slate-800 block">{material.name}</strong><span className="text-slate-500">Minimum {material.minimumStock} {material.unit}</span></div><span className="font-bold text-rose-700 whitespace-nowrap">{material.quantity} {material.unit} left</span></div>)}</div></section>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-900">{editingMaterialId ? 'Edit material' : 'Add material'}</h3><p className="text-xs text-slate-500 mt-1">Maintain the current stock level and supplier details.</p></div>{editingMaterialId && <button type="button" onClick={() => { setEditingMaterialId(null); setMaterialForm(emptyMaterialForm()); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>}</div>
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5" onSubmit={handleMaterialSubmit}>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Material name<input className="mt-1" value={materialForm.name} onChange={(event) => updateMaterialForm('name', event.target.value)} placeholder="e.g. OPC Cement 53 Grade" /></label>
            <label className="text-xs font-bold text-slate-600">Category<select className="mt-1" value={materialForm.category} onChange={(event) => updateMaterialForm('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Unit<input className="mt-1" value={materialForm.unit} onChange={(event) => updateMaterialForm('unit', event.target.value)} placeholder="bags, kg, cu ft" /></label>
            <label className="text-xs font-bold text-slate-600">Current quantity<input className="mt-1" type="number" min="0" step="0.01" value={materialForm.quantity} onChange={(event) => updateMaterialForm('quantity', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-600">Minimum stock<input className="mt-1" type="number" min="0" step="0.01" value={materialForm.minimumStock} onChange={(event) => updateMaterialForm('minimumStock', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-600">Unit price (₹)<input className="mt-1" type="number" min="0" step="0.01" value={materialForm.unitPrice} onChange={(event) => updateMaterialForm('unitPrice', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-600">Supplier<input className="mt-1" value={materialForm.supplier} onChange={(event) => updateMaterialForm('supplier', event.target.value)} placeholder="Supplier name" /></label>
            <div className="sm:col-span-2 flex items-center gap-3"><button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {editingMaterialId ? 'Update material' : 'Add material'}</button>{materialError && <p className="text-xs font-semibold text-rose-600" role="alert">{materialError}</p>}</div>
          </form>
        </section>

        <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div><h3 className="text-sm font-bold text-slate-900">Record stock movement</h3><p className="text-xs text-slate-500 mt-1">Stock-in increases availability; consumption reduces it.</p></div>
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5" onSubmit={handleMovementSubmit}>
            <label className="text-xs font-bold text-slate-600">Material<select className="mt-1" value={movementForm.materialId} onChange={(event) => updateMovementForm('materialId', event.target.value)}><option value="">Select material</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Movement type<select className="mt-1" value={movementForm.type} onChange={(event) => updateMovementForm('type', event.target.value)}><option value="STOCK_IN">Stock-in / delivery</option><option value="CONSUMPTION">Site consumption</option></select></label>
            <label className="text-xs font-bold text-slate-600">Quantity<input className="mt-1" type="number" min="0.01" step="0.01" value={movementForm.quantity} onChange={(event) => updateMovementForm('quantity', event.target.value)} placeholder="0" /></label>
            <label className="text-xs font-bold text-slate-600">Date<input className="mt-1" type="date" value={movementForm.date} onChange={(event) => updateMovementForm('date', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Note<input className="mt-1" value={movementForm.note} onChange={(event) => updateMovementForm('note', event.target.value)} placeholder="Delivery reference or site activity" /></label>
            <div className="sm:col-span-2 flex items-center gap-3"><button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><Truck className="w-4 h-4" /> Record movement</button>{movementError && <p className="text-xs font-semibold text-rose-600" role="alert">{movementError}</p>}</div>
          </form>
        </section>
      </div>

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5"><div><h3 className="text-sm font-bold text-slate-900">Material register</h3><p className="text-xs text-slate-500 mt-1">{filteredMaterials.length} of {materials.length} materials shown. {stockInCount} stock-in and {consumptionCount} consumption movements recorded.</p></div><div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto"><div className="relative sm:w-64"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input className="!pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search materials..." /></div><select className="sm:w-44" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Material</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Available</th><th className="px-3 py-3">Minimum</th><th className="px-3 py-3">Unit price</th><th className="px-3 py-3">Stock value</th><th className="px-3 py-3">Supplier</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filteredMaterials.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-500">No materials match the current filters.</td></tr> : filteredMaterials.map((material) => { const isLow = material.quantity <= material.minimumStock; return <tr key={material.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-4"><strong className="block text-xs text-slate-800">{material.name}</strong><small className="text-[11px] text-slate-500">{material.unit}</small></td><td className="px-3 py-4 text-xs text-slate-600">{material.category}</td><td className={`px-3 py-4 text-xs font-bold ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>{material.quantity} {material.unit}{isLow && <span className="ml-1 inline-flex" title="Low stock"><AlertTriangle className="w-3.5 h-3.5 inline" /></span>}</td><td className="px-3 py-4 text-xs text-slate-600">{material.minimumStock} {material.unit}</td><td className="px-3 py-4 text-xs font-semibold text-slate-800">{formatFullINR(material.unitPrice)}</td><td className="px-3 py-4 text-xs font-semibold text-slate-800">{formatINR(material.quantity * material.unitPrice)}</td><td className="px-3 py-4 text-xs text-slate-600">{material.supplier}</td><td className="px-3 py-4"><div className="flex items-center gap-3"><button type="button" onClick={() => startEditing(material)} className="text-xs font-semibold text-blue-600 hover:text-blue-800" title="Edit material"><Pencil className="w-3.5 h-3.5 inline mr-1" />Edit</button><button type="button" onClick={() => deleteMaterial(material)} className="text-xs font-semibold text-rose-600 hover:text-rose-800" title="Delete material"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button></div></td></tr>; })}</tbody></table></div>
      </section>

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><div className="flex items-center gap-2 mb-4"><TrendingDown className="w-4 h-4 text-slate-500" /><h3 className="text-sm font-bold text-slate-900">Recent stock movements</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Material</th><th className="px-3 py-3">Movement</th><th className="px-3 py-3">Quantity</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Note</th></tr></thead><tbody>{movements.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">No stock movements recorded.</td></tr> : movements.slice(0, 10).map((movement) => <tr key={movement.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 text-xs font-semibold text-slate-800">{materialNames.get(movement.materialId) || 'Deleted material'}</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${movement.type === 'STOCK_IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{movement.type === 'STOCK_IN' ? <CheckCircle2 className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{movement.type === 'STOCK_IN' ? 'Stock-in' : 'Consumption'}</span></td><td className="px-3 py-3 text-xs font-semibold text-slate-700">{movement.quantity}</td><td className="px-3 py-3 text-xs text-slate-600">{formatDate(movement.date)}</td><td className="px-3 py-3 text-xs text-slate-500">{movement.note || '-'}</td></tr>)}</tbody></table></div></section>
    </div>
  );
};

export default MaterialsInventoryPage;