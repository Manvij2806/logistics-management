import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Delivery {
  id: number;
  delivery_id: string;
  tracking_number: string | null;
  pickup_address: string;
  drop_address: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  agent: string | null;
  agent_id: number | null;
  notes: string;
  created_at: string;
  recipient_name: string | null;
  recipient_address: string | null;
  recipient_pincode: string | null;
  recipient_phone?: string | null;
  sender_name: string | null;
  sender_address: string | null;
  sender_pincode: string | null;
  sender_phone?: string | null;
  verification_pin?: string | null;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  delivered_at?: string | null;

  package_description: string | null;
  package_weight: string | null;
  package_dimensions: string | null;
  priority: string | null;
  accepted?: string | null;
  payment_status?: string;
  payment_method?: string | null;
  agent_deactivating?: boolean;
}

export interface DeliveryListResponse {
  total: number;
  page: number;
  page_size: number;
  deliveries: Delivery[];
}

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/deliveries`;

  getDeliveries(params: { page?: number; page_size?: number; status?: string; search?: string } = {}): Observable<DeliveryListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    // Explicitly clamp page_size to 100 max to avoid backend 422 errors
    const pageSize = params.page_size ? Math.min(params.page_size, 100) : 100;
    httpParams = httpParams.set('page_size', pageSize);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<DeliveryListResponse>(`${this.apiUrl}/`, { params: httpParams });
  }

  getDelivery(id: number): Observable<Delivery> {
    return this.http.get<Delivery>(`${this.apiUrl}/${id}`);
  }

  updateDelivery(id: number, updates: Partial<Delivery>): Observable<Delivery> {
    return this.http.patch<Delivery>(`${this.apiUrl}/${id}`, updates);
  }

  getCoords(address: string): [number, number] {
    const addr = (address || '').toLowerCase();
    
    // Agra sub-localities
    if (addr.includes('agra')) {
      if (addr.includes('kamla nagar') || addr.includes('professor colony')) return [27.2096, 78.0267];
      if (addr.includes('rajpur chungi') || addr.includes('kaveri vihar')) return [27.1420, 78.0125];
      if (addr.includes('langre ki chowki') || addr.includes('langre')) return [27.2012, 78.0315];
      if (addr.includes('sanjay place')) return [27.1932, 78.0094];
      if (addr.includes('tajganj')) return [27.1650, 78.0425];
      if (addr.includes('sikandra')) return [27.2205, 77.9500];
      return [27.1767, 78.0081];
    }
    
    // Noida sub-localities
    if (addr.includes('noida')) {
      if (addr.includes('greater')) return [28.4744, 77.503];
      if (addr.includes('62')) return [28.6200, 77.3600];
      if (addr.includes('15')) return [28.5800, 77.3100];
      return [28.6273, 77.3725];
    }

    if (addr.includes('gurgaon') || addr.includes('gurugram')) return [28.4595, 77.0266];
    
    // Delhi sub-localities
    if (addr.includes('delhi')) {
      if (addr.includes('vasant')) return [28.5562, 77.1644];
      if (addr.includes('dwarka')) return [28.5889, 77.0594];
      if (addr.includes('rohini')) return [28.7158, 77.1147];
      return [28.6139, 77.209];
    }

    if (addr.includes('faridabad')) return [28.4089, 77.3178];
    if (addr.includes('ghaziabad')) return [28.6692, 77.4538];
    return [28.6139, 77.209];
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }
}
