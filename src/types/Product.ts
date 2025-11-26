import { Category } from "./Category";

// src/types/Product.ts
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
  // subcategory_id: string | null;  // ❌ REMOVER
  referencia: string | null;
  marca: string | null;
  tamanho: string | null;
  categories?: Category;
}