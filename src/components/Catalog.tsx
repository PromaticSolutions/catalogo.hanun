import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { supabase, Product, SiteSettings } from '../lib/supabase';
import { useCart } from '../lib/useCart';
import ProductCard from './ProductCard';
import CartModal from './CartModal';

interface Category {
  id: string;
  name: string;
  created_at?: string;
  parent_id?: string | null;
  children?: Category[];
}

export default function Catalog() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, totalItems } = useCart();
  const [showCartModal, setShowCartModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Novos estados para filtros simples
  const [availableMarcas, setAvailableMarcas] = useState<string[]>([]);
  const [availableTamanhos, setAvailableTamanhos] = useState<string[]>([]);
  const [selectedMarca, setSelectedMarca] = useState<string>('');
  const [selectedTamanho, setSelectedTamanho] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  function buildCategoryTree(items: Category[]): Category[] {
    const map = new Map<string, Category>();
    items.forEach((c) => map.set(c.id, { ...c, children: [] }));

    const roots: Category[] = [];
    items.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        const parent = map.get(c.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(map.get(c.id)!);
      } else {
        roots.push(map.get(c.id)!);
      }
    });

    return roots;
  }

  const loadProducts = async () => {
    setLoading(true);
    try {
      let categoryToSend: string | string[] | null = null;

      if (selectedSubcategory) {
        categoryToSend = selectedSubcategory;
      } else if (selectedCategory) {
        const categoryIds = [selectedCategory];
        const parentCategory = categoryTree.find(c => c.id === selectedCategory);
        
        if (parentCategory?.children && parentCategory.children.length > 0) {
          parentCategory.children.forEach(child => categoryIds.push(child.id));
        }
        
        categoryToSend = categoryIds.length > 1 ? categoryIds : selectedCategory;
      }

      let q = supabase.from('products').select('*').eq('is_active', true);
      
      if (searchTerm) q = q.ilike('name', `%${searchTerm}%`);
      
      if (categoryToSend) {
        if (Array.isArray(categoryToSend)) {
          q = q.in('category_id', categoryToSend);
        } else {
          q = q.eq('category_id', categoryToSend);
        }
      }

      // Filtros de marca e tamanho
      if (selectedMarca) q = q.eq('marca', selectedMarca);
      if (selectedTamanho) q = q.eq('tamanho', selectedTamanho);

      const { data } = await q.order('name', { ascending: true });
      setProducts(data || []);
    } catch (err) {
      console.error('Erro em loadProducts:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, parent_id, created_at')
      .order('name');

    if (data) {
      setCategoryTree(buildCategoryTree(data));
    }
  };

  // Carrega marcas e tamanhos disponíveis baseado na categoria
  const loadFilterOptions = async () => {
    let categoryToSend: string | string[] | null = null;

    if (selectedSubcategory) {
      categoryToSend = selectedSubcategory;
    } else if (selectedCategory) {
      const categoryIds = [selectedCategory];
      const parentCategory = categoryTree.find(c => c.id === selectedCategory);
      
      if (parentCategory?.children && parentCategory.children.length > 0) {
        parentCategory.children.forEach(child => categoryIds.push(child.id));
      }
      
      categoryToSend = categoryIds.length > 1 ? categoryIds : selectedCategory;
    }

    let q = supabase.from('products').select('marca, tamanho').eq('is_active', true);
    
    if (categoryToSend) {
      if (Array.isArray(categoryToSend)) {
        q = q.in('category_id', categoryToSend);
      } else {
        q = q.eq('category_id', categoryToSend);
      }
    }

    const { data } = await q;
    
    if (data) {
      // Extrai valores únicos de marca
      const marcas = [...new Set(data.map(p => p.marca).filter(Boolean))].sort();
      setAvailableMarcas(marcas as string[]);
      
      // Extrai valores únicos de tamanho
      const tamanhos = [...new Set(data.map(p => p.tamanho).filter(Boolean))].sort();
      setAvailableTamanhos(tamanhos as string[]);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('site_settings').select('*').single();
      if (data) setSettings(data);
    };
    
    loadSettings();
    loadCategories();
    loadProducts();
  }, []);

  useEffect(() => {
    loadFilterOptions();
    const t = setTimeout(() => loadProducts(), 300);
    return () => clearTimeout(t);
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedMarca, selectedTamanho]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
          <h1 className="text-xl font-bold">{settings?.company_name || "Catálogo"}</h1>

          <button onClick={() => setShowCartModal(true)} className="relative">
            <ShoppingBag className="h-7 w-7" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-6 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />

        <select
          value={selectedCategory || ""}
          onChange={(e) => {
            setSelectedCategory(e.target.value || null);
            setSelectedSubcategory(null);
            setSelectedMarca('');
            setSelectedTamanho('');
          }}
          className="px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">Todas categorias</option>
          {categoryTree.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {selectedCategory && 
         categoryTree.find(c => c.id === selectedCategory)?.children && 
         categoryTree.find(c => c.id === selectedCategory)!.children!.length > 0 && (
            <select
              value={selectedSubcategory || ""}
              onChange={(e) => {
                setSelectedSubcategory(e.target.value || null);
                setSelectedMarca('');
                setSelectedTamanho('');
              }}
              className="px-3 py-2 border rounded-lg bg-white"
            >
              <option value="">Todas subcategorias</option>
              {categoryTree
                .find(c => c.id === selectedCategory)
                ?.children?.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
            </select>
          )}

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-2 border rounded-lg bg-white flex items-center gap-2 whitespace-nowrap"
        >
          <span className="text-lg">⚙️</span> Filtros
        </button>
      </div>

      {showFilters && (availableMarcas.length > 0 || availableTamanhos.length > 0) && (
        <div className="max-w-7xl mx-auto bg-white p-4 mt-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableMarcas.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Marca</label>
                <select
                  value={selectedMarca}
                  onChange={(e) => setSelectedMarca(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                >
                  <option value="">Todas as marcas</option>
                  {availableMarcas.map((marca) => (
                    <option key={marca} value={marca}>
                      {marca}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {availableTamanhos.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Tamanho</label>
                <select
                  value={selectedTamanho}
                  onChange={(e) => setSelectedTamanho(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                >
                  <option value="">Todos os tamanhos</option>
                  {availableTamanhos.map((tamanho) => (
                    <option key={tamanho} value={tamanho}>
                      {tamanho}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {loading ? (
          <div className="text-center py-20">Carregando...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">Nenhum produto encontrado</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => addToCart(product)}
                primaryColor={settings?.primary_color || "#2563eb"}
              />
            ))}
          </div>
        )}
      </main>

      {showCartModal && settings && (
        <CartModal
          settings={settings}
          onClose={() => setShowCartModal(false)}
        />
      )}
    </div>
  );
}