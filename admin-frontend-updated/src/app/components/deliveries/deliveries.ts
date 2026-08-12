import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeliveryService, Delivery } from '../../services/delivery';
import { AgentService } from '../../services/agent';
import { AuditLogService } from '../../services/audit-log';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deliveries.html',
  styleUrl: './deliveries.css',
})
export class Deliveries implements OnInit {
  private deliveryService = inject(DeliveryService);
  private agentService = inject(AgentService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);

  agents = signal<string[]>(['Unassigned']);

  deliveries = signal<Delivery[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(10);
  totalPages = signal(1);

  isLoading = signal(true);
  loadError = signal<string | null>(null);

  searchQuery = signal('');
  statusFilter = signal('');

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly statuses = [
    'Pending',
    'Assigned',
    'Picked Up',
    'In Transit',
    'Delivered',
    'Cancelled',
    'Unassigned',
  ];

  showCreateModal = signal(false);
  showEditModal = signal(false);
  selectedDelivery = signal<Delivery | null>(null);
  isSubmitting = signal(false);
  submitError = signal<string | null>(null);

  /*
   * DELIVERY FORM
   *
   * Added:
   *   sender_email
   *   recipient_email
   */
  deliveryForm = {
    sender_name: '',
    sender_address: '',
    sender_pincode: '',
    sender_phone: '',
    sender_email: '',

    recipient_name: '',
    recipient_address: '',
    recipient_pincode: '',
    recipient_phone: '',
    recipient_email: '',

    customer_phone: '',

    package_description: '',
    package_weight: '',
    package_dimensions: '',

    priority: 'Normal',
    notes: '',
    status: 'Created',
    agent: 'Unassigned',
    payment_status: 'Unpaid',
    payment_method: ''
  };

  ngOnInit(): void {
    this.fetchAgents();
    this.fetchDeliveries();
  }

  fetchAgents(): void {
    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents.set([
          'Unassigned',
          ...agents.map((a) => a.fullname)
        ]);
      },
      error: () => {
        this.agents.set(['Unassigned']);
      },
    });
  }

  fetchDeliveries(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.deliveryService
      .getDeliveries({
        page: this.page(),
        page_size: this.pageSize(),
        status: this.statusFilter() || undefined,
        search: this.searchQuery() || undefined,
      })
      .subscribe({
        next: (res) => {

          const oldDeliveries = this.deliveries();

          if (oldDeliveries.length > 0) {
            res.deliveries.forEach((newD) => {

              const oldD = oldDeliveries.find(
                (o) => o.id === newD.id
              );

              if (
                oldD &&
                oldD.payment_status !== 'Paid' &&
                newD.payment_status === 'Paid'
              ) {
                this.notificationService.addNotification(
                  `Payment of ₹2,000 received`,
                  `for delivery ${newD.delivery_id}!`,
                  'success'
                );
              }
            });
          }

          this.deliveries.set(res.deliveries);
          this.total.set(res.total);

          this.totalPages.set(
            Math.max(
              1,
              Math.ceil(res.total / res.page_size)
            )
          );

          this.isLoading.set(false);
        },

        error: () => {
          this.loadError.set(
            'Failed to load deliveries. Please try again.'
          );

          this.isLoading.set(false);
        },
      });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);

    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }

    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      this.fetchDeliveries();
    }, 300);
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.fetchDeliveries();
  }

  goToPage(page: number): void {
    if (
      page < 1 ||
      page > this.totalPages()
    ) {
      return;
    }

    this.page.set(page);
    this.fetchDeliveries();
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Delivered: 'status-delivered',
      'In Transit': 'status-in-transit',
      'Picked Up': 'status-picked-up',
      Assigned: 'status-assigned',
      Pending: 'status-pending',
      Cancelled: 'status-cancelled',
      Unassigned: 'status-unassigned',
    };

    return map[status] ?? 'status-pending';
  }

  onUpdateAgent(
    d: Delivery,
    newAgent: string
  ): void {

    const previousAgent =
      d.agent ?? 'Unassigned';

    const agentValue =
      newAgent === 'Unassigned'
        ? null
        : newAgent;

    this.deliveryService
      .updateDelivery(d.id, {
        agent: agentValue
      })
      .subscribe({

        next: () => {

          const details =
            `Assigned agent "${newAgent}" to delivery ${d.delivery_id} ` +
            `(previously "${previousAgent}")`;

          this.auditLogService.addLog(
            'Delivery Agent Assigned',
            'Assignment',
            details
          );

          this.notificationService.addNotification(
            `New delivery ${d.delivery_id} assigned`,
            `to Agent ${newAgent}`,
            'info'
          );

          this.fetchDeliveries();
        },

        error: () => {
          this.loadError.set(
            'Failed to update delivery agent.'
          );
        }
      });
  }

  onUpdateStatus(
    d: Delivery,
    newStatus: string
  ): void {

    const previousStatus = d.status;

    this.deliveryService
      .updateDelivery(d.id, {
        status: newStatus
      })
      .subscribe({

        next: () => {

          const details =
            `Changed status of delivery ${d.delivery_id} ` +
            `to "${newStatus}" ` +
            `(previously "${previousStatus}")`;

          const type =
            newStatus === 'Delivered'
              ? 'success'
              : newStatus === 'Cancelled'
                ? 'error'
                : 'info';

          this.auditLogService.addLog(
            'Delivery Status Updated',
            'Status',
            details
          );

          this.notificationService.addNotification(
            `Delivery ${d.delivery_id} ${newStatus.toLowerCase()}`,
            d.agent
              ? `by Agent ${d.agent}`
              : 'by System',
            type
          );

          this.fetchDeliveries();
        },

        error: () => {
          this.loadError.set(
            'Failed to update delivery status.'
          );
        }
      });
  }

  // =========================================================
  // CREATE MODAL
  // =========================================================

  openCreateModal(): void {

    this.deliveryForm = {

      sender_name: '',
      sender_address: '',
      sender_pincode: '',
      sender_phone: '',
      sender_email: '',

      recipient_name: '',
      recipient_address: '',
      recipient_pincode: '',
      recipient_phone: '',
      recipient_email: '',

      customer_phone: '',

      package_description: '',
      package_weight: '',
      package_dimensions: '',

      priority: 'Normal',
      notes: '',
      status: 'Created',
      agent: 'Unassigned',
      payment_status: 'Unpaid',
      payment_method: ''
    };

    this.submitError.set(null);
    this.showCreateModal.set(true);
  }

  // =========================================================
  // EDIT MODAL
  // =========================================================

  openEditModal(d: Delivery): void {

    this.selectedDelivery.set(d);

    let sAddr = d.sender_address || '';
    let sPin = d.sender_pincode || '';

    if (!sAddr && d.pickup_address) {

      const idx =
        d.pickup_address.lastIndexOf(',');

      if (idx !== -1) {

        sAddr =
          d.pickup_address
            .substring(0, idx)
            .trim();

        sPin =
          d.pickup_address
            .substring(idx + 1)
            .trim();

      } else {

        sAddr = d.pickup_address;
      }
    }

    let rAddr = d.recipient_address || '';
    let rPin = d.recipient_pincode || '';

    if (!rAddr && d.drop_address) {

      const idx =
        d.drop_address.lastIndexOf(',');

      if (idx !== -1) {

        rAddr =
          d.drop_address
            .substring(0, idx)
            .trim();

        rPin =
          d.drop_address
            .substring(idx + 1)
            .trim();

      } else {

        rAddr = d.drop_address;
      }
    }

    this.deliveryForm = {

      sender_name:
        d.sender_name || '',

      sender_address:
        sAddr,

      sender_pincode:
        sPin,

      sender_phone:
        d.sender_phone || '',

      sender_email:
        (d as any).sender_email || '',


      recipient_name:
        d.recipient_name ||
        d.customer_name ||
        '',

      recipient_address:
        rAddr,

      recipient_pincode:
        rPin,

      recipient_phone:
        d.recipient_phone || '',

      recipient_email:
        (d as any).recipient_email || '',


      customer_phone:
        d.customer_phone || '',


      package_description:
        d.package_description || '',

      package_weight:
        d.package_weight || '',

      package_dimensions:
        d.package_dimensions || '',

      priority:
        d.priority || 'Normal',

      notes:
        d.notes || '',

      status:
        d.status,

      agent:
        d.agent ?? 'Unassigned',

      payment_status:
        d.payment_status || 'Unpaid',

      payment_method:
        d.payment_method || ''
    };

    this.submitError.set(null);
    this.showEditModal.set(true);
  }

  closeModals(): void {

    this.showCreateModal.set(false);
    this.showEditModal.set(false);
    this.selectedDelivery.set(null);
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  validateForm(): boolean {

    const {
      sender_name,
      sender_address,
      sender_pincode,
      sender_phone,
      sender_email,

      recipient_name,
      recipient_address,
      recipient_pincode,
      recipient_phone,
      recipient_email,

      customer_phone
    } = this.deliveryForm;


    if (
      !sender_name.trim() ||
      !sender_address.trim() ||
      !sender_pincode.trim() ||
      !sender_phone.trim() ||
      !sender_email.trim() ||

      !recipient_name.trim() ||
      !recipient_address.trim() ||
      !recipient_pincode.trim() ||
      !recipient_phone.trim() ||
      !recipient_email.trim() ||

      !customer_phone.trim()
    ) {

      this.submitError.set(
        'Sender details, Sender email, Recipient details, Recipient email, and Customer phone are required.'
      );

      return false;
    }


    // Email validation
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailRegex.test(sender_email.trim())) {

      this.submitError.set(
        'Please enter a valid Sender email address.'
      );

      return false;
    }


    if (!emailRegex.test(recipient_email.trim())) {

      this.submitError.set(
        'Please enter a valid Recipient email address.'
      );

      return false;
    }


    if (
      sender_address.trim().toLowerCase() ===
      recipient_address.trim().toLowerCase()
    ) {

      this.submitError.set(
        'Pickup address and drop address cannot be the same.'
      );

      return false;
    }


    const cleanPhone =
      customer_phone
        .replace(/\s+/g, '')
        .replace(/-+/g, '');

    const cleanSenderPhone =
      sender_phone
        .replace(/\s+/g, '')
        .replace(/-+/g, '');

    const cleanRecipientPhone =
      recipient_phone
        .replace(/\s+/g, '')
        .replace(/-+/g, '');


    if (
      !/^\d{10}$/.test(cleanPhone) ||
      !/^\d{10}$/.test(cleanSenderPhone) ||
      !/^\d{10}$/.test(cleanRecipientPhone)
    ) {

      this.submitError.set(
        'Customer, Sender, and Recipient phone numbers must contain exactly 10 digits.'
      );

      return false;
    }


    if (
      cleanSenderPhone === cleanRecipientPhone &&
      sender_name.trim().toLowerCase() !==
      recipient_name.trim().toLowerCase()
    ) {

      this.submitError.set(
        'Sender phone and Recipient phone cannot be the same for two different users.'
      );

      return false;
    }


    if (
      !/^\d{6}$/.test(sender_pincode.trim()) ||
      !/^\d{6}$/.test(recipient_pincode.trim())
    ) {

      this.submitError.set(
        'Pincodes must be exactly 6 digits.'
      );

      return false;
    }


    return true;
  }

  // =========================================================
  // CREATE DELIVERY
  // =========================================================

  onCreateSubmit(): void {

    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const f = this.deliveryForm;

    const pickup_address =
      `${f.sender_address.trim()}, ${f.sender_pincode.trim()}`;

    const drop_address =
      `${f.recipient_address.trim()}, ${f.recipient_pincode.trim()}`;


    const payload = {

      pickup_address,
      drop_address,

      customer_name:
        f.recipient_name.trim(),

      customer_phone:
        f.customer_phone
          .replace(/\s+/g, '')
          .replace(/-+/g, ''),

      /*
       * NEW EMAIL FIELDS
       */
      sender_email:
        f.sender_email.trim(),

      recipient_email:
        f.recipient_email.trim(),


      notes:
        f.notes.trim() || null,

      status:
        f.status as any,

      agent:
        f.agent === 'Unassigned'
          ? null
          : f.agent,

      payment_status:
        f.payment_status,

      payment_method:
        f.payment_method || null,


      recipient_name:
        f.recipient_name.trim(),

      recipient_address:
        f.recipient_address.trim(),

      recipient_pincode:
        f.recipient_pincode.trim(),

      recipient_phone:
        f.recipient_phone
          .replace(/\s+/g, '')
          .replace(/-+/g, ''),


      sender_name:
        f.sender_name.trim(),

      sender_address:
        f.sender_address.trim(),

      sender_pincode:
        f.sender_pincode.trim(),

      sender_phone:
        f.sender_phone
          .replace(/\s+/g, '')
          .replace(/-+/g, ''),


      package_description:
        f.package_description || null,

      package_weight:
        f.package_weight || null,

      package_dimensions:
        f.package_dimensions || null,

      priority:
        f.priority || 'Normal'
    };


    this.deliveryService
      .createDelivery(payload)
      .subscribe({

        next: (created) => {

          this.isSubmitting.set(false);

          this.closeModals();

          const details =
            `Created new shipment record: ` +
            `${created.delivery_id} ` +
            `(Tracking: ${created.tracking_number})`;

          this.auditLogService.addLog(
            'Delivery Record Created',
            'User Action',
            details
          );

          this.notificationService.addNotification(
            'Delivery shipment created',
            created.delivery_id,
            'success'
          );

          this.fetchDeliveries();
        },

        error: (err) => {

          this.isSubmitting.set(false);

          if (err.status === 422) {

            const detail =
              err.error?.detail;

            this.submitError.set(

              Array.isArray(detail)
                ? detail
                    .map((e: any) => e.msg)
                    .join(' ')
                : 'Validation error: Please check fields.'
            );

          } else {

            this.submitError.set(
              err.error?.detail ||
              'An error occurred while creating delivery.'
            );
          }
        }
      });
  }

  // =========================================================
  // EDIT DELIVERY
  // =========================================================

  onEditSubmit(): void {

    const d =
      this.selectedDelivery();

    if (
      !d ||
      !this.validateForm()
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const f =
      this.deliveryForm;

    const pickup_address =
      `${f.sender_address.trim()}, ${f.sender_pincode.trim()}`;

    const drop_address =
      `${f.recipient_address.trim()}, ${f.recipient_pincode.trim()}`;


    const updates = {

      pickup_address,
      drop_address,

      customer_name:
        f.recipient_name.trim(),

      customer_phone:
        f.customer_phone
          .replace(/\s+/g, '')
          .replace(/-+/g, ''),


      /*
       * NEW EMAIL FIELDS
       */
      sender_email:
        f.sender_email.trim(),

      recipient_email:
        f.recipient_email.trim(),


      notes:
        f.notes.trim() ||
        'Notes are empty',

      status:
        f.status as any,

      agent:
        f.agent === 'Unassigned'
          ? null
          : f.agent,

      payment_status:
        f.payment_status,

      payment_method:
        f.payment_method || null,


      recipient_name:
        f.recipient_name.trim(),

      recipient_address:
        f.recipient_address.trim(),

      recipient_pincode:
        f.recipient_pincode.trim(),

      recipient_phone:
        f.recipient_phone
          .replace(/\s+/g, '')
          .replace(/-+/g, ''),


      sender_name:
        f.sender_name.trim(),

      sender_address:
        f.sender_address.trim(),

      sender_pincode:
        f.sender_pincode.trim(),

      sender_phone:
        f.sender_phone
          .replace(/\s+/g, '')
          .replace(/-+/g, ''),


      package_description:
        f.package_description || null,

      package_weight:
        f.package_weight || null,

      package_dimensions:
        f.package_dimensions || null,

      priority:
        f.priority || 'Normal'
    };


    this.deliveryService
      .updateDelivery(
        d.id,
        updates
      )
      .subscribe({

        next: (updated) => {

          this.isSubmitting.set(false);

          this.closeModals();

          const details =
            `Updated shipment details for ${updated.delivery_id}`;

          this.auditLogService.addLog(
            'Delivery Record Updated',
            'Status',
            details
          );

          this.notificationService.addNotification(
            'Delivery details updated',
            updated.delivery_id,
            'info'
          );

          this.fetchDeliveries();
        },

        error: (err) => {

          this.isSubmitting.set(false);

          this.submitError.set(
            err.error?.detail ||
            'An error occurred while updating delivery.'
          );
        }
      });
  }

  // =========================================================
  // DELETE
  // =========================================================

  onDeleteDelivery(
    d: Delivery
  ): void {

    if (
      !confirm(
        `Are you sure you want to permanently delete delivery ${d.delivery_id}?`
      )
    ) {
      return;
    }

    this.deliveryService
      .deleteDelivery(d.id)
      .subscribe({

        next: () => {

          const details =
            `Deleted shipment record ${d.delivery_id}`;

          this.auditLogService.addLog(
            'Delivery Record Deleted',
            'User Action',
            details
          );

          this.notificationService.addNotification(
            'Delivery record deleted',
            d.delivery_id,
            'error'
          );

          this.fetchDeliveries();
        },

        error: () => {

          this.loadError.set(
            'Failed to delete delivery record.'
          );
        }
      });
  }
}
