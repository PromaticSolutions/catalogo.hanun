import { Category } from "./Category";

export interface Product {
  id: string;

  // CAMPOS QUE ESTÃO FALTANDO
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;

  // Campos já existentes
  category_id: string | null;
  subcategory_id: string | null;
  referencia: string | null;
  marca: string | null;
  tamanho: string | null;
  categories?: Category;

  category?: { name: string };
  subcategory?: { name: string };
}
