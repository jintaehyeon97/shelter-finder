export interface Shelter {
  id: string;
  category: string; // '무더위쉼터' | '한파쉼터'
  facilityType?: string;
  name: string;
  address?: string;
  roadAddress?: string;
  capacity?: number;
  hasFan?: string;
  hasAircon?: string;
  lat: number;
  lng: number;
  distance?: number;
}
