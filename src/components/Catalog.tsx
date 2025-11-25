import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { supabase, Product, SiteSettings, Attribute } from '../lib/supabase';
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

  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
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

      // Se selecionou subcategoria específica, usa apenas ela
      if (selectedSubcategory) {
        categoryToSend = selectedSubcategory;
      }
      // Se selecionou apenas categoria pai, inclui ela + todas as subcategorias
      else if (selectedCategory) {
        const categoryIds = [selectedCategory];
        const parentCategory = categoryTree.find(c => c.id === selectedCategory);
        
        if (parentCategory?.children && parentCategory.children.length > 0) {
          // Adiciona todas as subcategorias
          parentCategory.children.forEach(child => categoryIds.push(child.id));
        }
        
        categoryToSend = categoryIds.length > 1 ? categoryIds : selectedCategory;
      }

      // Tenta usar RPC apenas se for string única (sem array)
      if (typeof categoryToSend === 'string' && Object.values(selectedFilters).length > 0) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('filter_products', {
            category_id_param: categoryToSend,
            search_term_param: searchTerm || null,
            selected_options: Object.values(selectedFilters).filter((id) => id) || [],
          });

          if (rpcData && !rpcError) {
            setProducts(rpcData as Product[]);
            setLoading(false);
            return;
          }
        } catch (rpcErr) {
          console.warn('RPC não disponível, usando query direta');
        }
      }

      // Query direta (fallback e para múltiplas categorias)
      let q = supabase.from('products').select('*').eq('is_active', true);
      
      if (searchTerm) q = q.ilike('name', `%${searchTerm}%`);
      
      // Aplica filtro de categoria(s)
      if (categoryToSend) {
        if (Array.isArray(categoryToSend)) {
          q = q.in('category_id', categoryToSend);
        } else {
          q = q.eq('category_id', categoryToSend);
        }
      }

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

  const loadAttributes = async (categoryId: string | null) => {
    if (!categoryId) {
      const { data } = await supabase
        .from('attributes')
        .select('id, name, attribute_options(id, value)');
      setAvailableAttributes((data as unknown) as Attribute[] || []);
      return;
    }

    // Monta array de IDs para buscar atributos
    let categoryIds: string[] = [];
    
    // Se tem subcategoria selecionada, usa apenas ela
    if (selectedSubcategory) {
      categoryIds = [selectedSubcategory];
    }
    // Se tem apenas categoria pai, inclui ela + todas subcategorias
    else if (selectedCategory) {
      categoryIds = [selectedCategory];
      const parentCategory = categoryTree.find(c => c.id === selectedCategory);
      
      if (parentCategory?.children && parentCategory.children.length > 0) {
        parentCategory.children.forEach(child => categoryIds.push(child.id));
      }
    }

    // Tenta usar a RPC para pegar atributos de múltiplas categorias
    const { data } = await supabase.rpc('get_attributes_by_category', {
      category_id_param: categoryIds.length > 0 ? categoryIds : null,
    });

    if (data) {
      setAvailableAttributes((data as unknown) as Attribute[]);
    } else {
      // Fallback: busca todos os atributos
      const { data: all } = await supabase
        .from('attributes')
        .select('id, name, attribute_options(id, value)');
      setAvailableAttributes((all as unknown) as Attribute[] || []);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('site_settings').select('*').single();
      if (data) setSettings(data);
    };
    
    loadSettings();
    loadCategories();
    loadAttributes(null);
    supabase.auth.getUser();
    loadProducts();
  }, []);

  useEffect(() => {
    loadAttributes(selectedSubcategory || selectedCategory);
    const t = setTimeout(() => loadProducts(), 300);
    return () => clearTimeout(t);
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedFilters]);

  const handleFilterChange = (attributeId: string, optionId: string) => {
    setSelectedFilters((prev) => {
      const next = { ...prev };
      if (optionId) next[attributeId] = optionId;
      else delete next[attributeId];
      return next;
    });
  };

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
            setSelectedFilters({});
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
                setSelectedFilters({});
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
          className="px-3 py-2 border rounded-lg bg-white flex items-center gap-2"
        >
          <span className="text-lg">⚙️</span> Filtros
        </button>
      </div>

      {showFilters && availableAttributes.length > 0 && (
        <div className="max-w-7xl mx-auto bg-white p-4 mt-4 rounded-lg shadow">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableAttributes.map(attr => (
              <div key={attr.id}>
                <label className="block text-sm font-medium mb-1">{attr.name}</label>
                <select
                  value={selectedFilters[attr.id] || ""}
                  onChange={(e) => handleFilterChange(attr.id, e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                >
                  <option value="">Todos</option>
                  {attr.attribute_options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
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
  );   ///comentario para commit 
}
