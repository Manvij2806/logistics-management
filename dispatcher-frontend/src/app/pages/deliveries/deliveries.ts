import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';

import { DeliveryService, DeliveryCreate } from '../../services/delivery.service';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    InputTextModule,
    SelectModule,
    DialogModule,
    TextareaModule,
    RouterModule
  ],
  templateUrl: './deliveries.html',
  styleUrl: './deliveries.scss'
})
export class Deliveries implements OnInit {
  private deliveryService = inject(DeliveryService);
  public router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  searchTerm = '';
  selectedStatus: any = null;
  selectedTime: any = null;
  showCreateDialog = false;
  showViewDialog = false;
  showEditDialog = false;
  isReadOnly = false;
  formErrors: any = {};
  editFormErrors: any = {};

  // ── READ-ONLY statuses (cannot edit) ──────────────────────────────────
  readOnlyStatuses = ['Assigned', 'Picked Up', 'In Transit', 'In Transit (Hub-to-Hub)', 'Arrived at Destination Hub', 'Arrived at Origin Hub', 'Delivered', 'Cancelled'];

  isReadOnlyStatus(status: string): boolean {
    return this.readOnlyStatuses.includes(status);
  }

  isStatusReadOnly = false;

  isStatusReadOnlyStatus(status: string): boolean {
    return ['Delivered', 'Cancelled'].includes(status);
  }

  newDelivery = {
    pickupAddress: '',
    pickupPincode: '',
    dropAddress: '',
    dropPincode: '',
    customerName: '',
    customerPhone: '',
    packageDetails: '',
    agent: null as any,
    notes: ''
  };

  viewedDelivery: any = null;

  editDelivery = {
    dbId: 0,
    pickupAddress: '',
    pickupPincode: '',
    dropAddress: '',
    dropPincode: '',
    customerName: '',
    customerPhone: '',
    packageDetails: '',
    status: '',
    agent: null as any,
    notes: ''
  };

  agentOptions = [
    { label: 'John Driver (Available)', value: 'John Driver' },
    { label: 'Rahul Transport (Available)', value: 'Rahul Transport' },
    { label: 'Mehhul Agent (Available)', value: 'Mehhul Agent' },
    { label: 'Unassigned', value: null }
  ];

  statusOptions = [
    { label: 'All Status', value: null },
    { label: 'Created', value: 'Created' },
    { label: 'In Transit', value: 'In Transit' },
    { label: 'Picked Up', value: 'Picked Up' },
    { label: 'Assigned', value: 'Assigned' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Delivered', value: 'Delivered' },
    { label: 'Cancelled', value: 'Cancelled' },
    { label: 'In Transit (Hub-to-Hub)', value: 'In Transit (Hub-to-Hub)' },
    { label: 'Arrived at Destination Hub', value: 'Arrived at Destination Hub' },
    { label: 'Arrived at Origin Hub', value: 'Arrived at Origin Hub' }
  ];

  timeOptions = [
    { label: 'All Time', value: null },
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
  ];

  deliveries: any[] = [];

  ngOnInit() {
    this.loadDeliveries();
  }

  loadDeliveries() {
    this.deliveryService.getDeliveries(this.selectedStatus).subscribe({
      next: (res) => {
        this.deliveries = res.map(d => ({
          id: d.delivery_id,
          dbId: d.id,
          trackingNumber: d.tracking_number,
          pickup: d.pickup_address,
          drop: d.drop_address,
          status: d.status,
          agent: d.agent || 'Unassigned',
          customerName: d.customer_name,
          customerPhone: d.customer_phone,
          packageDetails: d.package_details || '',
          notes: d.notes,
          createdAt: new Date(d.created_at),
          created: new Date(d.created_at).toLocaleString('en-US', {
            month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })
        }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading deliveries', err);
      }
    });
  }

  get filteredDeliveries() {
    const now = new Date();
    return this.deliveries.filter(d => {
      if (this.selectedTime === 'today') {
        const isToday = d.createdAt.getDate() === now.getDate() &&
                        d.createdAt.getMonth() === now.getMonth() &&
                        d.createdAt.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (this.selectedTime === 'week') {
        const startOfWeek = new Date();
        const day = startOfWeek.getDay();
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);
        if (d.createdAt < startOfWeek) return false;
      } else if (this.selectedTime === 'month') {
        const isThisMonth = d.createdAt.getMonth() === now.getMonth() &&
                            d.createdAt.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      }

      const search = this.searchTerm.trim().toLowerCase();
      if (!search) return true;
      return d.id.toLowerCase().includes(search) ||
        (d.trackingNumber && d.trackingNumber.toLowerCase().includes(search)) ||
        d.pickup.toLowerCase().includes(search) ||
        d.drop.toLowerCase().includes(search) ||
        d.agent.toLowerCase().includes(search) ||
        d.customerName.toLowerCase().includes(search);
    });
  }

  getSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | null | undefined {
    const map: Record<string, 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'> = {
      'Created': 'secondary',
      'In Transit': 'info',
      'Picked Up': 'secondary',
      'Assigned': 'contrast',
      'Pending': 'warn',
      'Delivered': 'success',
      'Cancelled': 'danger'
    };
    return map[status];
  }

  normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  validateForm(): boolean {
    this.formErrors = {};

    if (!this.newDelivery.pickupAddress.trim())
      this.formErrors.pickupAddress = 'Pickup address is required';

    if (!this.newDelivery.pickupPincode.trim())
      this.formErrors.pickupPincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(this.newDelivery.pickupPincode))
      this.formErrors.pickupPincode = 'Enter valid 6-digit pincode';

    if (!this.newDelivery.dropAddress.trim()) {
      this.formErrors.dropAddress = 'Drop address is required';
    } else if (this.normalizeAddress(this.newDelivery.pickupAddress) === this.normalizeAddress(this.newDelivery.dropAddress)) {
      this.formErrors.dropAddress = 'Pickup and Drop addresses cannot be the same.';
    }

    if (!this.newDelivery.dropPincode.trim()) {
      this.formErrors.dropPincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.newDelivery.dropPincode)) {
      this.formErrors.dropPincode = 'Enter valid 6-digit pincode';
    } else if (this.newDelivery.pickupPincode.trim() === this.newDelivery.dropPincode.trim()) {
      this.formErrors.dropPincode = 'Pickup and Drop pincodes cannot be the same.';
    }

    if (!this.newDelivery.customerName.trim())
      this.formErrors.customerName = 'Customer name is required';

    if (!this.newDelivery.customerPhone.trim())
      this.formErrors.customerPhone = 'Phone number is required';
    else if (!/^\+?\d{10,13}$/.test(this.newDelivery.customerPhone.replace(/\s/g, '')))
      this.formErrors.customerPhone = 'Enter valid phone number';

    return Object.keys(this.formErrors).length === 0;
  }

  validateEditForm(): boolean {
    this.editFormErrors = {};

    if (!this.editDelivery.pickupAddress.trim())
      this.editFormErrors.pickupAddress = 'Pickup address is required';

    if (!this.editDelivery.pickupPincode.trim())
      this.editFormErrors.pickupPincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(this.editDelivery.pickupPincode))
      this.editFormErrors.pickupPincode = 'Enter valid 6-digit pincode';

    if (!this.editDelivery.dropAddress.trim()) {
      this.editFormErrors.dropAddress = 'Drop address is required';
    } else if (this.normalizeAddress(this.editDelivery.pickupAddress) === this.normalizeAddress(this.editDelivery.dropAddress)) {
      this.editFormErrors.dropAddress = 'Pickup and Drop addresses cannot be the same.';
    }

    if (!this.editDelivery.dropPincode.trim()) {
      this.editFormErrors.dropPincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.editDelivery.dropPincode)) {
      this.editFormErrors.dropPincode = 'Enter valid 6-digit pincode';
    } else if (this.editDelivery.pickupPincode.trim() === this.editDelivery.dropPincode.trim()) {
      this.editFormErrors.dropPincode = 'Pickup and Drop pincodes cannot be the same.';
    }

    if (!this.editDelivery.customerName.trim())
      this.editFormErrors.customerName = 'Customer name is required';

    if (!this.editDelivery.customerPhone.trim())
      this.editFormErrors.customerPhone = 'Phone number is required';
    else if (!/^\+?\d{10,13}$/.test(this.editDelivery.customerPhone.replace(/\s/g, '')))
      this.editFormErrors.customerPhone = 'Enter valid phone number';

    return Object.keys(this.editFormErrors).length === 0;
  }

  openCreate() {
    this.formErrors = {};
    this.newDelivery = {
      pickupAddress: '',
      pickupPincode: '',
      dropAddress: '',
      dropPincode: '',
      customerName: '',
      customerPhone: '',
      packageDetails: '',
      agent: null,
      notes: ''
    };
    this.showCreateDialog = true;
  }

  createDelivery() {
    if (!this.validateForm()) return;

    const payload: DeliveryCreate = {
      pickup_address: this.newDelivery.pickupAddress.trim() + ' - ' + this.newDelivery.pickupPincode.trim(),
      drop_address: this.newDelivery.dropAddress.trim() + ' - ' + this.newDelivery.dropPincode.trim(),
      customer_name: this.newDelivery.customerName.trim(),
      customer_phone: this.newDelivery.customerPhone.trim(),
      package_details: this.newDelivery.packageDetails.trim() || null,
      agent: this.newDelivery.agent || null,
      notes: this.newDelivery.notes
    };

    this.deliveryService.createDelivery(payload).subscribe({
      next: () => {
        this.loadDeliveries();
        this.showCreateDialog = false;
      },
      error: (err) => {
        console.error('Error creating delivery', err);
      }
    });
  }

  cancelCreate() {
    this.formErrors = {};
    this.showCreateDialog = false;
  }

  view(d: any) {
    this.viewedDelivery = d;
    this.showViewDialog = true;
  }

  edit(d: any) {
    const pickupParts = d.pickup.split(' - ');
    const pickupPincode = pickupParts.length > 1 ? pickupParts[pickupParts.length - 1] : '';
    const pickupAddress = pickupParts.length > 1 ? pickupParts.slice(0, -1).join(' - ') : d.pickup;

    const dropParts = d.drop.split(' - ');
    const dropPincode = dropParts.length > 1 ? dropParts[dropParts.length - 1] : '';
    const dropAddress = dropParts.length > 1 ? dropParts.slice(0, -1).join(' - ') : d.drop;

    this.editDelivery = {
      dbId: d.dbId,
      pickupAddress,
      pickupPincode,
      dropAddress,
      dropPincode,
      customerName: d.customerName || '',
      customerPhone: d.customerPhone || '',
      packageDetails: d.packageDetails || '',
      status: d.status,
      agent: d.agent === 'Unassigned' ? null : d.agent,
      notes: d.notes || ''
    };

    // ── Set read-only mode based on status ────────────────────────────
    this.isReadOnly = this.isReadOnlyStatus(d.status);
    this.isStatusReadOnly = this.isStatusReadOnlyStatus(d.status);
    this.editFormErrors = {};
    this.showEditDialog = true;
  }

  updateDelivery() {
    if (this.isStatusReadOnly) return;
    if (!this.validateEditForm()) return;

    const payload: DeliveryCreate = {
      pickup_address: this.editDelivery.pickupAddress.trim() + ' - ' + this.editDelivery.pickupPincode.trim(),
      drop_address: this.editDelivery.dropAddress.trim() + ' - ' + this.editDelivery.dropPincode.trim(),
      customer_name: this.editDelivery.customerName.trim(),
      customer_phone: this.editDelivery.customerPhone.trim(),
      package_details: this.editDelivery.packageDetails.trim() || null,
      status: this.editDelivery.status as any,
      agent: this.editDelivery.agent || null,
      notes: this.editDelivery.notes
    };

    this.deliveryService.updateDelivery(this.editDelivery.dbId, payload).subscribe({
      next: () => {
        this.loadDeliveries();
        this.showEditDialog = false;
      },
      error: (err) => {
        console.error('Error updating delivery', err);
      }
    });
  }

  cancelEdit() {
    this.editFormErrors = {};
    this.isReadOnly = false;
    this.showEditDialog = false;
  }
}
