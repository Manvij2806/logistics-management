import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { DeliveryService } from '../../../services/delivery.service';

@Component({
  selector: 'app-delivery-details',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TagModule, CardModule],
  templateUrl: './delivery-details.html',
  styleUrl: './delivery-details.scss'
})
export class DeliveryDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private deliveryService = inject(DeliveryService);
  private cdr = inject(ChangeDetectorRef);

  delivery: any = null;
  loading = true;

  timelineSteps = [
    { key: 'Created',                      label: 'Created' },
    { key: 'Assigned',                     label: 'Assigned (Pickup)' },
    { key: 'Picked Up',                    label: 'Picked Up' },
    { key: 'Arrived at Origin Hub',        label: 'Arrived at Origin Hub' },
    { key: 'In Transit (Hub-to-Hub)',      label: 'In Transit (Hub-to-Hub)' },
    { key: 'Arrived at Destination Hub',   label: 'Arrived at Destination Hub' },
    { key: 'Out for Delivery',             label: 'Out for Delivery' },
    { key: 'Delivered',                    label: 'Delivered' },
  ];

  statusOrder = [
    'Created',
    'Pending',
    'Assigned',
    'Picked Up',
    'Arrived at Origin Hub',
    'In Transit (Hub-to-Hub)',
    'Arrived at Destination Hub',
    'Out for Delivery',
    'Delivered'
  ];
  allDeliveries: any[] = [];
  hasSelected = false;


  ngOnInit() {
    this.loadAllDeliveries();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      const numId = Number(id);
      if (id && id !== 'null' && !isNaN(numId)) {
        this.hasSelected = true;
        this.loadDelivery(numId);
      } else {
        this.hasSelected = false;
        this.autoSelectFirstDelivery();
      }
    });
  }

  autoSelectFirstDelivery() {
    this.deliveryService.getDeliveries().subscribe({
      next: (res) => {
        this.allDeliveries = res || [];
        if (this.allDeliveries.length > 0 && !this.hasSelected) {
          this.router.navigate(['/deliveries', this.allDeliveries[0].id, 'details']);
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadDelivery(numericId: number) {
    this.loading = true;
    // 1. Try to load instantly from cache
    const cached = this.deliveryService.getCachedDelivery(numericId);
    if (cached) {
      this.setDeliveryData(cached);
      this.loading = false;
      this.cdr.detectChanges();
    }

    // 2. Fetch fresh data in background to stay synchronized
    this.deliveryService.getDelivery(numericId, true).subscribe({
      next: (res) => {
        this.setDeliveryData(res);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading delivery', err);
        this.loading = false;
        this.cdr.detectChanges();
        alert('Delivery not found. Redirecting to deliveries list.');
        this.router.navigate(['/deliveries']);
      }
    });
  }

  loadAllDeliveries() {
    this.deliveryService.getDeliveries().subscribe({
      next: (res) => {
        this.allDeliveries = res || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading all deliveries', err);
      }
    });
  }

  selectDelivery(id: number) {
    this.hasSelected = true;
    this.router.navigate(['/deliveries', id, 'details']);
  }

  showBillModal = false;

  private setDeliveryData(res: any) {
    this.delivery = {
      id: res.delivery_id,
      dbId: res.id,
      trackingNumber: res.tracking_number,
      status: res.status,
      createdAt: new Date(res.created_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      priority: res.priority || 'Normal',
      pickup: {
        address: res.pickup_address,
        contact: res.sender_name || '—',
        phone: res.sender_phone || res.customer_phone,
      },
      drop: {
        address: res.drop_address,
        contact: res.recipient_name || res.customer_name,
        phone: res.recipient_phone || res.customer_phone,
      },

      package: {
        details: res.package_details || '—',
        description: res.package_description || '—',
        weight: res.package_weight || '—',
        dimensions: res.package_dimensions || '—',
      },
      agent: res.agent || 'Not Assigned',
      notes: res.notes || '—',
      payment_status: res.payment_status || 'Unpaid',
      payment_method: res.payment_method || null,
      payment_responsibility: res.payment_responsibility || 'Sender',
      delivery_charge: res.delivery_charge || 0,
      cod_amount: res.cod_amount || 0,
      pkg_length: res.pkg_length || 0,
      pkg_width: res.pkg_width || 0,
      pkg_height: res.pkg_height || 0,
      delivery_distance: res.delivery_distance || 0,
      is_fragile: res.is_fragile || false,
      declared_value: res.declared_value || 0,
      insurance_opt_in: res.insurance_opt_in || false,
      created_at: res.created_at,
      assigned_at: res.assigned_at,
      picked_up_at: res.picked_up_at,
      in_transit_at: res.in_transit_at,
      arrived_origin_at: res.arrived_origin_at,
      in_transit_hub_at: res.in_transit_hub_at,
      arrived_destination_at: res.arrived_destination_at,
      out_for_delivery_at: res.out_for_delivery_at,
      delivered_at: res.delivered_at,
    };
  }

  getStepTime(stepKey: string): string {
    if (!this.delivery) return '—';
    let dateVal = null;
    if (stepKey === 'Created') dateVal = this.delivery.created_at;
    else if (stepKey === 'Assigned') dateVal = this.delivery.assigned_at;
    else if (stepKey === 'Picked Up') dateVal = this.delivery.picked_up_at;
    else if (stepKey === 'Arrived at Origin Hub') dateVal = this.delivery.arrived_origin_at;
    else if (stepKey === 'In Transit (Hub-to-Hub)') dateVal = this.delivery.in_transit_hub_at;
    else if (stepKey === 'Arrived at Destination Hub') dateVal = this.delivery.arrived_destination_at;
    else if (stepKey === 'Out for Delivery') dateVal = this.delivery.out_for_delivery_at;
    else if (stepKey === 'Delivered') dateVal = this.delivery.delivered_at;
    
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '—';
    }
  }

  isStepDone(stepKey: string): boolean {
    if (!this.delivery) return false;
    const currentIndex = this.statusOrder.indexOf(this.delivery.status);
    const stepIndex = this.statusOrder.indexOf(stepKey);
    return stepIndex <= currentIndex;
  }

  isCurrentStep(stepKey: string): boolean {
    if (this.delivery?.status === 'Delivered' || this.delivery?.status === 'Cancelled') {
      return false;
    }
    return this.delivery?.status === stepKey;
  }

  getSeverity(status: string): any {
    const map: any = {
      'Created': 'secondary',
      'Pending': 'warn',
      'Assigned': 'contrast',
      'Picked Up': 'secondary',
      'In Transit': 'info',
      'Delivered': 'success',
      'Cancelled': 'danger'
    };
    return map[status];
  }

  goBack() {
    this.router.navigate(['/deliveries']);
  }

  goToSelectAgent() {
    this.router.navigate(['/deliveries', this.delivery.dbId, 'select-agent']);
  }

  copyTracking() {
    navigator.clipboard.writeText(this.delivery.trackingNumber);
  }
}
