import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Delivery, DeliveryService } from '../../services/delivery.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-shipment-details',
  standalone: true,
  imports: [CommonModule, Dialog, Button, Tag, FormsModule],
  templateUrl: './shipment-details.html',
  styleUrl: './shipment-details.scss'
})
export class ShipmentDetails {
  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);
  currentUser = this.authService.currentUser;

  @Input() shipment: Delivery | null = null;
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  selectedMethod = signal<'QR Code' | 'Card' | 'COD'>('QR Code');
  paymentProcessing = signal(false);
  paymentSuccess = signal(false);

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

  onHide() {
    this.close.emit();
    // Reset payment states when closing modal
    this.paymentProcessing.set(false);
    this.paymentSuccess.set(false);
  }

  selectPaymentMethod(method: 'QR Code' | 'Card' | 'COD') {
    if (method === 'COD' && this.shipment?.agent_deactivating) {
      return;
    }
    this.selectedMethod.set(method);
  }

  processPayment() {
    if (!this.shipment) return;
    this.paymentProcessing.set(true);

    // Call API to set status to Paid and method to selected method
    this.deliveryService.updateDelivery(this.shipment.id, {
      payment_status: 'Paid',
      payment_method: this.selectedMethod()
    }).subscribe({
      next: (res) => {
        this.paymentProcessing.set(false);
        this.paymentSuccess.set(true);
        this.shipment = res; // update local data
      },
      error: (err) => {
        console.error('Payment failed', err);
        this.paymentProcessing.set(false);
        alert('Payment update failed. Please try again.');
      }
    });
  }

  callDriver(driverName: string) {
    alert(`Calling driver ${driverName}...`);
  }

  messageDriver(driverName: string) {
    alert(`Opening chat with ${driverName}...`);
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
}
