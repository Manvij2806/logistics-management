import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DeliveryCreate {
  pickup_address: string;
  drop_address: string;
  customer_name: string;
  customer_phone: string;
  status?: string;
  agent?: string | null;
  agent_id?: number | null;
  accepted?: string | null;
  notes?: string | null;
  package_details?: string | null;
  payment_status?: string;
  payment_method?: string | null;
  recipient_name?: string | null;
  recipient_address?: string | null;
  recipient_pincode?: string | null;
  recipient_phone?: string | null;
  sender_name?: string | null;
  sender_address?: string | null;
  sender_pincode?: string | null;
  sender_phone?: string | null;
  verification_pin?: string | null;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  arrived_origin_at?: string | null;
  in_transit_hub_at?: string | null;
  arrived_destination_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
}

export interface DeliveryResponse {
  id: number;
  delivery_id: string;
  tracking_number: string;
  pickup_address: string;
  drop_address: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  agent: string | null;
  notes: string;
  package_details?: string | null;
  created_at: string;
  payment_status?: string;
  payment_method?: string | null;
  recipient_name?: string | null;
  recipient_address?: string | null;
  recipient_pincode?: string | null;
  recipient_phone?: string | null;
  sender_name?: string | null;
  sender_address?: string | null;
  sender_pincode?: string | null;
  sender_phone?: string | null;
  verification_pin?: string | null;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  arrived_origin_at?: string | null;
  in_transit_hub_at?: string | null;
  arrived_destination_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  agent_deactivating?: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private apiUrl = `${environment.apiUrl}/api/deliveries`;
  private cachedDeliveries: Map<number, DeliveryResponse> = new Map();

  constructor(private http: HttpClient) {}

  getDeliveries(status?: string | null): Observable<DeliveryResponse[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    params = params.set('page_size', '100');
    return this.http.get<{ deliveries: DeliveryResponse[] }>(this.apiUrl, { params }).pipe(
      map(res => res.deliveries || []),
      tap(deliveries => {
        deliveries.forEach(d => this.cachedDeliveries.set(d.id, d));
      })
    );
  }

  getDelivery(id: number, bypassCache = false): Observable<DeliveryResponse> {
    if (!bypassCache && this.cachedDeliveries.has(id)) {
      return of(this.cachedDeliveries.get(id)!);
    }
    return this.http.get<DeliveryResponse>(`${this.apiUrl}/${id}`).pipe(
      tap(delivery => this.cachedDeliveries.set(id, delivery))
    );
  }

  getCachedDelivery(id: number): DeliveryResponse | undefined {
    return this.cachedDeliveries.get(id);
  }

  createDelivery(delivery: DeliveryCreate): Observable<DeliveryResponse> {
    return this.http.post<DeliveryResponse>(`${this.apiUrl}/`, delivery).pipe(
      tap(created => this.cachedDeliveries.set(created.id, created))
    );
  }

  updateDelivery(id: number, delivery: DeliveryCreate): Observable<DeliveryResponse> {
    return this.http.patch<DeliveryResponse>(`${this.apiUrl}/${id}`, delivery).pipe(
      tap(updated => this.cachedDeliveries.set(updated.id, updated))
    );
  }
}
