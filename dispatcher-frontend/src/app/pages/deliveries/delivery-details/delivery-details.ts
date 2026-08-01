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
    { key: 'Created',    label: 'Created' },
    { key: 'Assigned',   label: 'Assigned' },
    { key: 'Picked Up',  label: 'Picked Up' },
    { key: 'In Transit', label: 'In Transit' },
    { key: 'Out for Delivery', label: 'Out for Delivery' },
    { key: 'Delivered',  label: 'Delivered' },
  ];

  statusOrder = ['Created', 'Pending', 'Assigned', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];
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
      priority: 'Normal',
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
      },
      agent: res.agent || 'Not Assigned',
      notes: res.notes || '—',
      payment_status: res.payment_status || 'Unpaid',
      payment_method: res.payment_method || null,
      created_at: res.created_at,
      assigned_at: res.assigned_at,
      picked_up_at: res.picked_up_at,
      in_transit_at: res.in_transit_at,
      delivered_at: res.delivered_at,
    };
  }

  getStepTime(stepKey: string): string {
    if (!this.delivery) return '—';
    let dateVal = null;
    if (stepKey === 'Created') dateVal = this.delivery.created_at;
    else if (stepKey === 'Assigned') dateVal = this.delivery.assigned_at;
    else if (stepKey === 'Picked Up') dateVal = this.delivery.picked_up_at;
    else if (stepKey === 'In Transit') dateVal = this.delivery.in_transit_at;
    else if (stepKey === 'Out for Delivery') dateVal = this.delivery.in_transit_at;
    else if (stepKey === 'Delivered') dateVal = this.delivery.delivered_at;
    
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
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
