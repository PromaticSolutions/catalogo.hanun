// src/types/Category.ts
export interface Category {
  id: string;
  name: string;
  parent_id: string | null;  // ADICIONE ESTA LINHA
  created_at?: string;
}