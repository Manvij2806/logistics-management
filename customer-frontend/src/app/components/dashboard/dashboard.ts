import { Component, OnInit, OnDestroy, Output, EventEmitter, HostListener, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tag } from 'primeng/tag';
import { Dialog } from 'primeng/dialog';
import { DeliveryService, Delivery } from '../../services/delivery.service';
import { AuthService } from '../../services/auth.service';
import { ShipmentDetails } from '../shipment-details/shipment-details';
import { Subscription, interval } from 'rxjs';
import { startWith } from 'rxjs/operators';

export interface CustomerNotification {
  id: string;
  type: 'transit' | 'delivery' | 'success' | 'created' | 'assignment' | 'delay';
  message: string;
  time: string;
  shipmentId: string;
  read: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, Tag, ShipmentDetails, Dialog],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  @Output() viewChange = new EventEmitter<string>();
  @Output() trackShipment = new EventEmitter<string>();

  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);


  currentUser = this.authService.currentUser;

  shipments: Delivery[] = [];
  alerts: CustomerNotification[] = [];

  activeShipmentsCount = 0;
  deliveredOrdersCount = 0;
  cancelledOrdersCount = 0;
  unreadAlertsCount = 0;

  selectedShipmentForDetails: Delivery | null = null;
  detailsVisible: boolean = false;
  showNotificationsDropdown = false;

  billVisible = false;
  selectedShipmentForBill: Delivery | null = null;
  billPaymentProcessing = signal(false);
  billPaymentSuccess = signal(false);

  toasts = signal<{ id: string; message: string }[]>([]);
  private pollSub?: Subscription;

  formatETA(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return 'N/A';
    }
  }

  getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'Delivered': return 'success';
      case 'Picked Up': return 'info';
      case 'In Transit': return 'info';
      case 'Assigned': return 'warn';
      case 'Cancelled': return 'danger';
      default: return 'secondary';
    }
  }

  ngOnInit() {
    this.loadCachedAlerts();

    // Poll deliveries every 5 seconds
    this.pollSub = interval(5000)
      .pipe(startWith(0))
      .subscribe(() => {
        this.fetchRealDeliveries();
      });
  }

  private loadCachedAlerts() {
    const username = this.currentUser()?.username || 'guest';
    const cached = localStorage.getItem('customer_notifications_' + username);
    if (cached) {
      try {
        this.alerts = JSON.parse(cached);
        this.unreadAlertsCount = this.alerts.filter(a => !a.read).length;
      } catch {
        this.alerts = [];
        this.unreadAlertsCount = 0;
      }
    } else {
      this.alerts = [];
      this.unreadAlertsCount = 0;
    }
  }


  fetchRealDeliveries() {
    this.deliveryService.getDeliveries({ page_size: 100 }).subscribe({
      next: (res) => {
        // Compare statuses to trigger alerts
        this.processStatusChanges(res.deliveries);

        this.shipments = res.deliveries;
        this.calculateKPIs();

        if (this.selectedShipmentForDetails) {
          const updated = res.deliveries.find(ship => ship.id === this.selectedShipmentForDetails!.id);
          if (updated) this.selectedShipmentForDetails = updated;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching customer deliveries', err);
      }
    });
  }


  private processStatusChanges(newDeliveries: Delivery[]) {
    const username = this.currentUser()?.username || 'guest';
    const notifications: CustomerNotification[] = JSON.parse(localStorage.getItem('customer_notifications_' + username) || '[]');
    let updated = false;

    newDeliveries.forEach((d) => {
      const prevStatusKey = `status_history_${username}_${d.id}`;
      const prevStatus = localStorage.getItem(prevStatusKey);

      const prevPinKey = `pin_history_${username}_${d.id}`;
      const prevPin = localStorage.getItem(prevPinKey);

      // 1. Check if status changed
      if (prevStatus && prevStatus !== d.status) {
        let msg = `Shipment ${d.delivery_id} status updated to ${d.status}!`;
        let type: CustomerNotification['type'] = 'transit';

        if (d.status === 'Delivered') {
          msg = `Your parcel is delivered! Please confirm the delivery for ${d.delivery_id}.`;
          type = 'success';
        } else if (d.status === 'Picked Up') {
          msg = `Your package is picked up for delivery ${d.delivery_id}.`;
          type = 'transit';
        } else if (d.status === 'In Transit') {
          msg = `Your package is in transit for delivery ${d.delivery_id}.`;
          type = 'transit';
        } else if (d.status === 'Assigned') {
          msg = `Your delivery agent is assigned. Delivery number: ${d.delivery_id}`;
          type = 'assignment';
        } else if (d.status === 'Cancelled') {
          msg = `Shipment ${d.delivery_id} has been cancelled.`;
          type = 'delay';
        }

        const newNotif: CustomerNotification = {
          id: 'ALT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          type,
          message: msg,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          shipmentId: d.delivery_id,
          read: false,
        };

        notifications.unshift(newNotif);
        updated = true;
        this.triggerOnScreenToast(msg);
        localStorage.setItem(prevStatusKey, d.status);
      } else if (!prevStatus) {
        // Initial load status save
        localStorage.setItem(prevStatusKey, d.status);
      }

      // 2. Check if a verification OTP PIN has been generated
      if (d.verification_pin && prevPin !== d.verification_pin) {
        if (this.getUserRoleInDelivery(d) === 'Receiver') {
          const msg = `Your parcel is ready for delivery! Please share verification PIN: ${d.verification_pin} with the delivery agent to confirm delivery.`;
          const newNotif: CustomerNotification = {
            id: 'ALT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            type: 'assignment',
            message: msg,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            shipmentId: d.delivery_id,
            read: false,
          };

          notifications.unshift(newNotif);
          updated = true;
          this.triggerOnScreenToast(msg);
        }
        localStorage.setItem(prevPinKey, d.verification_pin);
      } else if (!d.verification_pin && prevPin) {
        // PIN was cleared
        localStorage.removeItem(prevPinKey);
      }

    });

    if (updated) {
      localStorage.setItem('customer_notifications_' + username, JSON.stringify(notifications));
      this.alerts = notifications;
      this.unreadAlertsCount = this.alerts.filter(a => !a.read).length;
    }
  }


  triggerOnScreenToast(message: string) {
    const id = Math.random().toString();
    this.toasts.update(t => [...t, { id, message }]);
    setTimeout(() => {
      this.toasts.update(t => t.filter(x => x.id !== id));
    }, 5000);
  }

  private calculateKPIs() {
    this.activeShipmentsCount = this.shipments.filter(s => 
      ['Created', 'Pending', 'Assigned', 'Picked Up', 'In Transit', 'In Transit (Hub-to-Hub)', 'Arrived at Destination Hub', 'Arrived at Origin Hub'].includes(s.status)
    ).length;

    this.deliveredOrdersCount = this.shipments.filter(s => s.status === 'Delivered').length;
    this.cancelledOrdersCount = this.shipments.filter(s => s.status === 'Cancelled').length;
  }

  getActiveShipments(): Delivery[] {
    return this.shipments.filter(s => 
      ['Created', 'Pending', 'Assigned', 'Picked Up', 'In Transit', 'In Transit (Hub-to-Hub)', 'Arrived at Destination Hub', 'Arrived at Origin Hub'].includes(s.status)
    );
  }

  getUserRoleInDelivery(d: Delivery): string {
    const user = this.currentUser();
    const fullName = user?.full_name?.toLowerCase().trim();
    if (!fullName) return '';

    // 1. Phone number comparison (First-class check)
    const rawUserPhone = user?.phone_number || '';
    const userPhone = rawUserPhone.replace(/\D/g, '');

    const sPhone = d.sender_phone ? d.sender_phone.replace(/\D/g, '') : '';
    const rPhone = d.recipient_phone ? d.recipient_phone.replace(/\D/g, '') : '';

    if (userPhone) {
      if (sPhone && (userPhone.endsWith(sPhone) || sPhone.endsWith(userPhone))) {
        return 'Sender';
      }
      if (rPhone && (userPhone.endsWith(rPhone) || rPhone.endsWith(userPhone))) {
        return 'Receiver';
      }
    }

    // 2. Name comparison (Backup check)
    const sender = d.sender_name?.toLowerCase().trim() || '';
    const recipient = d.recipient_name?.toLowerCase().trim() || '';

    if (sender === fullName) {
      return 'Sender';
    }
    if (recipient === fullName) {
      return 'Receiver';
    }

    const userParts = fullName.split(/\s+/);
    const senderParts = sender.split(/\s+/);
    const recipientParts = recipient.split(/\s+/);

    const matchesSender = userParts.some(p => p.length > 2 && senderParts.includes(p)) || 
                         (sender && (fullName.includes(sender) || sender.includes(fullName)));
    const matchesRecipient = userParts.some(p => p.length > 2 && recipientParts.includes(p)) || 
                            (recipient && (fullName.includes(recipient) || recipient.includes(fullName)));

    if (matchesSender) {
      return 'Sender';
    }
    if (matchesRecipient) {
      return 'Receiver';
    }

    if (d.customer_name?.toLowerCase().trim() === fullName) {
      return 'Receiver';
    }

    return 'Sender';
  }

  getDeliveredShipments(): Delivery[] {
    return this.shipments.filter(s => s.status === 'Delivered');
  }

  getRecentAlerts(): CustomerNotification[] {
    return this.alerts.slice(0, 5);
  }

  markAlertAsRead(alertId: string, event: Event) {
    event.stopPropagation();
    this.alerts = this.alerts.map(a => a.id === alertId ? { ...a, read: true } : a);
    const username = this.currentUser()?.username || 'guest';
    localStorage.setItem('customer_notifications_' + username, JSON.stringify(this.alerts));
    this.unreadAlertsCount = this.alerts.filter(a => !a.read).length;
    this.cdr.detectChanges();
  }

  markAllAlertsAsRead() {
    this.alerts = this.alerts.map(a => ({ ...a, read: true }));
    const username = this.currentUser()?.username || 'guest';
    localStorage.setItem('customer_notifications_' + username, JSON.stringify(this.alerts));
    this.unreadAlertsCount = 0;
    this.cdr.detectChanges();
  }



  openShipmentDetails(shipment: Delivery) {
    this.selectedShipmentForDetails = shipment;
    this.detailsVisible = true;
  }

  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.showNotificationsDropdown = !this.showNotificationsDropdown;
  }

  @HostListener('document:click')
  closeNotificationsDropdown() {
    this.showNotificationsDropdown = false;
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'transit': return 'pi pi-truck';
      case 'delivery': return 'pi pi-compass';
      case 'success': return 'pi pi-check';
      case 'assignment': return 'pi pi-users';
      case 'created': return 'pi pi-box';
      case 'delay': return 'pi pi-exclamation-circle';
      default: return 'pi pi-bell';
    }
  }

  handleAlertClick(alert: CustomerNotification) {
    this.alerts = this.alerts.map(a => a.id === alert.id ? { ...a, read: true } : a);
    localStorage.setItem('customer_notifications', JSON.stringify(this.alerts));
    this.unreadAlertsCount = this.alerts.filter(a => !a.read).length;

    const matched = this.shipments.find(s => s.delivery_id === alert.shipmentId);
    if (matched) {
      this.openShipmentDetails(matched);
    }
    this.showNotificationsDropdown = false;
  }

  navigateTo(viewId: string) {
    this.viewChange.emit(viewId);
  }

  openBillBreakdown(shipment: Delivery, event: Event) {
    event.stopPropagation(); // Prevent opening shipment details card
    this.selectedShipmentForBill = shipment;
    this.billPaymentSuccess.set(false);
    this.billPaymentProcessing.set(false);
    this.billVisible = true;
  }

  payBillFromModal() {
    if (!this.selectedShipmentForBill) return;
    this.billPaymentProcessing.set(true);

    this.deliveryService.updateDelivery(this.selectedShipmentForBill.id, {
      payment_status: 'Paid',
      payment_method: 'Card' // Default card payment from quick checkout
    }).subscribe({
      next: (res) => {
        this.billPaymentProcessing.set(false);
        this.billPaymentSuccess.set(true);
        this.selectedShipmentForBill = res; // update local modal data
        
        // Update it in the shipments list too
        const idx = this.shipments.findIndex(s => s.id === res.id);
        if (idx !== -1) {
          this.shipments[idx] = res;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Payment failed from bill modal', err);
        this.billPaymentProcessing.set(false);
        alert('Payment failed. Please try again.');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }
}
