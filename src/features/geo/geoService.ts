import { supabase } from '@/lib/supabase';
import type { GeoDepartment, GeoCity } from './geo.types';

function mapDepartment(row: { id: string; country_code: string; name: string; code: string; sort_order: number }): GeoDepartment {
  return {
    id: row.id,
    countryCode: row.country_code,
    name: row.name,
    code: row.code,
    sortOrder: row.sort_order,
  };
}

function mapCity(row: { id: string; department_id: string; name: string; code: string | null; sort_order: number }): GeoCity {
  return {
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    code: row.code,
    sortOrder: row.sort_order,
  };
}

export const geoService = {
  async getDepartments(countryCode = 'CO'): Promise<GeoDepartment[]> {
    const { data, error } = await supabase
      .from('geo_departments')
      .select('*')
      .eq('country_code', countryCode)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDepartment);
  },

  async getCities(departmentId: string): Promise<GeoCity[]> {
    const { data, error } = await supabase
      .from('geo_cities')
      .select('*')
      .eq('department_id', departmentId)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCity);
  },
};
