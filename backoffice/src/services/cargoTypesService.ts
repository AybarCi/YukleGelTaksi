import axios from 'axios';
import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

export interface CargoType {
  id: number;
  name: string;
  description: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCargoTypeData {
  name: string;
  description: string;
  image_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateCargoTypeData {
  name?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface CargoTypesResponse {
  success: boolean;
  data: CargoType[];
  message?: string;
}

export interface CargoTypeResponse {
  success: boolean;
  data: CargoType;
  message?: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
}

class CargoTypesService {
  public async getCargoTypes(): Promise<CargoType[]> {
    try {
      const response = await axios.get<CargoTypesResponse>(`${API_BASE_URL}/admin/cargo-types`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Yük tipleri alınamadı');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Yük tipleri alınırken hata oluştu');
    }
  }

  public async getCargoType(id: number): Promise<CargoType> {
    try {
      const response = await axios.get<CargoTypeResponse>(`${API_BASE_URL}/admin/cargo-types/${id}`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Yük tipi bulunamadı');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Yük tipi alınırken hata oluştu');
    }
  }

  public async createCargoType(data: CreateCargoTypeData): Promise<CargoType> {
    try {
      const response = await axios.post<CargoTypeResponse>(`${API_BASE_URL}/admin/cargo-types`, data);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Yük tipi oluşturulamadı');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Yük tipi oluşturulurken hata oluştu');
    }
  }

  public async updateCargoType(id: number, data: UpdateCargoTypeData): Promise<CargoType> {
    try {
      const response = await axios.put<CargoTypeResponse>(`${API_BASE_URL}/admin/cargo-types`, { id, ...data });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Yük tipi güncellenemedi');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Yük tipi güncellenirken hata oluştu');
    }
  }

  public async deleteCargoType(id: number): Promise<void> {
    try {
      const response = await axios.delete<ApiResponse>(`${API_BASE_URL}/admin/cargo-types/${id}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Yük tipi silinemedi');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Yük tipi silinirken hata oluştu');
    }
  }

  public async uploadImage(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post<{ success: boolean; url: string; message?: string }>(
        `${API_BASE_URL}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        return response.data.url;
      } else {
        throw new Error(response.data.message || 'Resim yüklenemedi');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Resim yüklenirken hata oluştu');
    }
  }
}

export default new CargoTypesService();