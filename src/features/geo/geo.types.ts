export interface GeoDepartment {
  id: string;
  countryCode: string;
  name: string;
  code: string;
  sortOrder: number;
}

export interface GeoCity {
  id: string;
  departmentId: string;
  name: string;
  code: string | null;
  sortOrder: number;
}
