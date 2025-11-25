import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Plus, Edit, Trash2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  children?: Category[];
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  const buildCategoryTree = (items: Category[]): Category[] => {
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
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('id, name, parent_id')
      .order('name');
    
    if (data) {
      setCategories(data);
      setCategoryTree(buildCategoryTree(data));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const name = editingCategory ? editingCategory.name : newCategoryName;
    if (!name.trim()) return;

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', editingCategory.id);
      if (!error) setEditingCategory(null);
    } else {
      const categoryData = {
        name,
        parent_id: parentCategoryId || null,
      };
      const { error } = await supabase.from('categories').insert(categoryData);
      if (!error) {
        setNewCategoryName('');
        setParentCategoryId('');
      }
    }
    loadCategories();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza? Excluir uma categoria removerá a associação de todos os produtos.')) {
      await supabase.from('categories').delete().eq('id', id);
      loadCategories();
    }
  };

  const renderCategoryRow = (cat: Category, level: number = 0) => {
    const indent = level * 24;
    
    return (
      <div key={cat.id}>
        <li className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
          {editingCategory?.id === cat.id ? (
            <input
              type="text"
              value={editingCategory.name}
              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 rounded-md"
            />
          ) : (
            <span className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
              {level > 0 && <span className="text-gray-400">→</span>}
              <Package className="h-4 w-4 text-gray-500" />
              <span className={level > 0 ? 'text-gray-700' : 'font-semibold'}>{cat.name}</span>
              {level === 0 && cat.children && cat.children.length > 0 && (
                <span className="text-xs text-gray-500 ml-2">({cat.children.length} sub)</span>
              )}
            </span>
          )}
          <div className="flex gap-3">
            {editingCategory?.id === cat.id ? (
              <button onClick={handleSave} className="text-green-600 hover:text-green-800 text-sm">Salvar</button>
            ) : (
              <button onClick={() => setEditingCategory(cat)} className="text-blue-600 hover:text-blue-800">
                <Edit className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:text-red-800">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </li>
        
        {/* Renderiza subcategorias */}
        {cat.children && cat.children.length > 0 && (
          <div className="ml-6 mt-2 space-y-2">
            {cat.children.map(child => renderCategoryRow(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Categorias e Subcategorias</h2>
        <p className="text-gray-600">Gerencie a hierarquia de categorias dos seus produtos</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="font-semibold mb-4">Nova Categoria</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Categoria Pai (opcional)</label>
            <select
              value={parentCategoryId}
              onChange={(e) => setParentCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Nenhuma (criar categoria principal)</option>
              {categories
                .filter(c => !c.parent_id) // Apenas categorias pai
                .map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={parentCategoryId ? "Ex: Marca XYZ" : "Ex: Acessórios"}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button 
              onClick={handleSave} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" /> Salvar
            </button>
          </div>
          
          {parentCategoryId && (
            <p className="text-sm text-gray-500">
              💡 Será criada como subcategoria de: <strong>{categories.find(c => c.id === parentCategoryId)?.name}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="font-semibold mb-4">Categorias Existentes</h3>
        <ul className="space-y-2">
          {loading ? (
            <p className="text-gray-500">Carregando...</p>
          ) : categoryTree.length === 0 ? (
            <p className="text-gray-500">Nenhuma categoria cadastrada</p>
          ) : (
            categoryTree.map(cat => renderCategoryRow(cat, 0))
          )}
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Como funciona:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Categorias principais:</strong> Ex: "Acessórios", "Bebidas"</li>
          <li>• <strong>Subcategorias:</strong> Ex: "Marcas", "Tipos" dentro de "Acessórios"</li>
          <li>• Quando o cliente seleciona a categoria principal, vê produtos de todas as subcategorias</li>
          <li>• Quando seleciona uma subcategoria, vê apenas produtos dela</li>
        </ul>
      </div>
    </div>
  );
}