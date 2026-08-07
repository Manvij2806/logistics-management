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
  sender_name: string | null;
  sender_address: string | null;
  sender_pincode: string | null;
  sender_phone?: string | null;
  recipient_phone?: string | null;
  package_description: string | null;

  package_weight: string | null;
  package_dimensions: string | null;
  priority: string | null;
  accepted?: string | null;
  payment_status?: string;
  payment_method?: string | null;
  payment_responsibility?: string | null;
  delivery_charge?: number | null;
  cod_amount?: number | null;
  pkg_length?: number | null;
  pkg_width?: number | null;
  pkg_height?: number | null;
  delivery_distance?: number | null;
  is_fragile?: boolean | null;
  declared_value?: number | null;
  insurance_opt_in?: boolean | null;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  delivered_at?: string | null;
  agent_deactivating?: boolean;
  current_route_geometry?: string | null;
}

export interface DeliveryListResponse {
  total: number;
  page: number;
  page_size: number;
  deliveries: Delivery[];
}

export interface DeliveryListParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

export interface DeliveryCreate {
  pickup_address: string;
  drop_address: string;
  customer_name: string;
  customer_phone: string;
  status?: string;
  agent?: string | null;
  agent_id?: number | null;
  notes?: string | null;
  recipient_name?: string | null;
  recipient_address?: string | null;
  recipient_pincode?: string | null;
  sender_name?: string | null;
  sender_address?: string | null;
  sender_pincode?: string | null;
  sender_phone?: string | null;
  recipient_phone?: string | null;
  package_description?: string | null;

  package_weight?: string | null;
  package_dimensions?: string | null;
  priority?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_responsibility?: string | null;
  delivery_charge?: number | null;
  cod_amount?: number | null;
  pkg_length?: number | null;
  pkg_width?: number | null;
  pkg_height?: number | null;
  delivery_distance?: number | null;
  is_fragile?: boolean | null;
  declared_value?: number | null;
  insurance_opt_in?: boolean | null;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  delivered_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/deliveries`;

  getDeliveries(params: DeliveryListParams = {}): Observable<DeliveryListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.page_size) httpParams = httpParams.set('page_size', params.page_size);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<DeliveryListResponse>(`${this.apiUrl}/`, { params: httpParams });
  }

  getDelivery(id: number): Observable<Delivery> {
    return this.http.get<Delivery>(`${this.apiUrl}/${id}`);
  }

  createDelivery(payload: DeliveryCreate): Observable<Delivery> {
    return this.http.post<Delivery>(`${this.apiUrl}/`, payload);
  }

  /** Partial update — sends only the provided fields via PATCH (matches the backend's DeliveryUpdate schema). */
  updateDelivery(id: number, updates: Partial<Delivery>): Observable<Delivery> {
    return this.http.patch<Delivery>(`${this.apiUrl}/${id}`, updates);
  }
}
