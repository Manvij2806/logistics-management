import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';

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
  package_description: string | null;
  package_weight: string | null;
  package_dimensions: string | null;
  priority: string | null;
  accepted: string | null;
  payment_status?: string;
  payment_method?: string | null;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  arrived_origin_at?: string | null;
  in_transit_hub_at?: string | null;
  arrived_destination_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  agent_deactivating?: boolean;
  estimated_delivery_at?: string | null;
  current_route_geometry?: string | null;
}

export interface DeliveryListResponse {
  total: number;
  page: number;
  page_size: number;
  deliveries: Delivery[];
}

@Injectable({
  providedIn: 'root',
})
export class DeliveryService {
  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);
  private apiUrl = `${environment.apiUrl}/api/deliveries`;

  private requestVisibleSubject = new BehaviorSubject<boolean>(false);
  requestVisible$: Observable<boolean> = this.requestVisibleSubject.asObservable();

  private pendingDeliverySubject = new BehaviorSubject<Delivery | null>(null);
  pendingDelivery$: Observable<Delivery | null> = this.pendingDeliverySubject.asObservable();

  private deliveriesSubject = new BehaviorSubject<Delivery[]>([]);
  deliveries$: Observable<Delivery[]> = this.deliveriesSubject.asObservable();

  private pollingIntervalId: any = null;

  constructor() {}

  startPolling(): void {
    if (this.pollingIntervalId) return;
    this.loadAgentDeliveries(); // load once immediately
    this.pollingIntervalId = setInterval(() => {
      this.loadAgentDeliveries();
    }, 5000); // Poll every 5 seconds
  }

  stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  loadAgentDeliveries(): void {
    this.getDeliveries({ page_size: 100 }).subscribe({
      next: (res) => {
        // Check for payment status transitions to Paid
        const previousDeliveries = this.deliveriesSubject.value;
        if (previousDeliveries && previousDeliveries.length > 0) {
          res.deliveries.forEach((newD) => {
            const oldD = previousDeliveries.find((o) => o.id === newD.id);
            if (oldD && oldD.payment_status !== 'Paid' && newD.payment_status === 'Paid') {
              this.notificationService.addNotification(
                'Payment Received',
                `Payment of ₹2,000 received for delivery ${newD.delivery_id}!`,
                'success'
              );
            }
          });
        }

        this.deliveriesSubject.next(res.deliveries);

        // Find pending request for the notification modal
        const pending = res.deliveries.find((d) => d.accepted === 'Pending');
        if (pending) {
          this.showRequest(pending);

          // Add notification if not already shown
          const notifiedKey = `notified_req_${pending.id}`;
          if (localStorage.getItem(notifiedKey) !== 'true') {
            localStorage.setItem(notifiedKey, 'true');
            this.notificationService.addNotification(
              'New Delivery Assigned',
              `Delivery #${pending.delivery_id} is pending your acceptance.`,
              'info'
            );
          }
        } else {
          this.clearRequest();
        }
      },
    });
  }

  getDeliveries(
    params: { page?: number; page_size?: number; status?: string; search?: string } = {},
  ): Observable<DeliveryListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.page_size) httpParams = httpParams.set('page_size', params.page_size);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<DeliveryListResponse>(`${this.apiUrl}/`, { params: httpParams });
  }

  /** Partial update — sends only the provided fields via PATCH (matches the backend's DeliveryUpdate schema). */
  updateDelivery(id: number, updates: Partial<Delivery>): Observable<Delivery> {
    return this.http.patch<Delivery>(`${this.apiUrl}/${id}`, updates);
  }

  requestOtp(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/request-otp`, {});
  }

  verifyOtp(id: number, pin: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/verify-otp`, { pin });
  }

  optimizeRoute(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/optimize-route`, {});
  }

  applyRoute(id: number, payload: { route_id: string; reason: string; notes?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/apply-route`, payload);
  }

  hideRequest(): void {
    this.requestVisibleSubject.next(false);
  }

  showRequest(delivery: Delivery): void {
    this.pendingDeliverySubject.next(delivery);
    this.requestVisibleSubject.next(true);
  }

  clearRequest(): void {
    this.pendingDeliverySubject.next(null);
    this.requestVisibleSubject.next(false);
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

    // Bangalore sub-localities
    if (addr.includes('bangalore') || addr.includes('banglore') || addr.includes('bengaluru')) {
      if (addr.includes('hsr') || addr.includes('hsr layout')) return [12.9141, 77.6411];
      if (addr.includes('koramangala')) return [12.9279, 77.6271];
      if (addr.includes('kamla nagar') || addr.includes('kamlanagar')) return [12.9912, 77.5385];
      if (addr.includes('indiranagar')) return [12.9719, 77.6412];
      if (addr.includes('whitefield')) return [12.9698, 77.7500];
      return [12.9716, 77.5946];
    }

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

  getEarnings(distance: number): number {
    return 2000;
  }
}
