// src/types/Product.ts
import { Category } from './Category';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  // NOVO: Adicione esta linha para resolver o erro de tipagem
  subcategory_id: string | null; 
  referencia: string | null;
  marca: string | null;        
  tamanho: string | null;      
  categories?: Category;
}
