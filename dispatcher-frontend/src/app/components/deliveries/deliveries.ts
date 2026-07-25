import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DeliveryService, Delivery } from '../../services/delivery';
import { AgentService, Agent } from '../../services/agent';
import { AuditLogService, AuditLog } from '../../services/audit-log';
import { NotificationService } from '../../services/notification';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './deliveries.html',
  styleUrl: './deliveries.css',
})
export class Deliveries implements OnInit {
  private deliveryService = inject(DeliveryService);
  private agentService = inject(AgentService);
  private auditLogService = inject(AuditLogService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  protected readonly Math = Math;

  // ── View management state ────────────────────────────────────────────────
  // activeTab can be 'deliveries' or 'workload'
  activeTab = signal<'deliveries' | 'workload'>('deliveries');
  // currentView can be 'list', 'details', 'assign'
  currentView = signal<'list' | 'details' | 'assign'>('list');

  // ── List / Search state ──────────────────────────────────────────────────
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
    'Created',
    'Pending',
    'Assigned',
    'Picked Up',
    'In Transit',
    'In Transit (Hub-to-Hub)',
    'Arrived at Destination Hub',
    'Delivered',
    'Cancelled',
  ];

  // ── Selected Delivery & Assignment State ──────────────────────────────────
  selectedDelivery = signal<Delivery | null>(null);
  agents = signal<Agent[]>([]);
  isLoadingAgents = signal(false);
  loadAgentsError = signal<string | null>(null);
  isAssigning = signal(false);
  assignError = signal<string | null>(null);

  // Filtered/computed assignment logs for the selected delivery
  assignmentHistory = computed<AuditLog[]>(() => {
    const delivery = this.selectedDelivery();
    if (!delivery) return [];
    return this.auditLogService
      .logs()
      .filter(
        (log) =>
          log.category === 'Assignment' &&
          log.details.includes(delivery.delivery_id)
      );
  });

  // ── Create form state ─────────────────────────────────────────────────────
  showCreateForm = signal(false);
  isSubmitting = signal(false);
  createError = signal<string | null>(null);
  createSuccess = signal<string | null>(null);

  createForm = this.fb.group({
    sender_name: ['', [Validators.required, Validators.minLength(2)]],
    sender_address: ['', [Validators.required, Validators.minLength(5)]],
    sender_pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    sender_phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    recipient_name: ['', [Validators.required, Validators.minLength(2)]],
    recipient_address: ['', [Validators.required, Validators.minLength(5)]],
    recipient_pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    recipient_phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    customer_phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    package_description: [''],
    package_weight: [''],
    package_dimensions: [''],
    priority: ['Normal'],
    notes: [''],

  });

  ngOnInit(): void {
    this.fetchDeliveries();
    this.fetchAgents();
  }

  // ── Tab switcher ─────────────────────────────────────────────────────────
  setTab(tab: 'deliveries' | 'workload'): void {
    this.activeTab.set(tab);
    if (tab === 'workload') {
      this.fetchAgents();
    } else {
      this.showList();
    }
  }

  // ── List / Search ────────────────────────────────────────────────────────
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
          this.deliveries.set(res.deliveries);
          this.total.set(res.total);
          this.totalPages.set(Math.max(1, Math.ceil(res.total / res.page_size)));
          this.isLoading.set(false);
          this.checkForRejectedDeliveries(res.deliveries);
        },
        error: () => {
          this.loadError.set('Failed to load deliveries. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  checkForRejectedDeliveries(deliveries: Delivery[]): void {
    deliveries.forEach((d) => {
      if (d.accepted === 'Rejected') {
        this.notificationService.addNotification(
          `Delivery ${d.delivery_id} Rejected`,
          `Agent has rejected the delivery.`,
          'error'
        );
        this.deliveryService.updateDelivery(d.id, { accepted: 'Acknowledged' }).subscribe();
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
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
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.fetchDeliveries();
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Created: 'status-created',
      Delivered: 'status-delivered',
      'In Transit': 'status-in-transit',
      'Picked Up': 'status-picked-up',
      Assigned: 'status-assigned',
      Pending: 'status-pending',
      Cancelled: 'status-cancelled',
    };
    return map[status] ?? 'status-pending';
  }

  // ── Details View ─────────────────────────────────────────────────────────
  selectDelivery(delivery: Delivery): void {
    this.selectedDelivery.set(delivery);
    this.currentView.set('details');
  }

  showList(): void {
    this.currentView.set('list');
    this.selectedDelivery.set(null);
    this.assignError.set(null);
    this.fetchDeliveries();
  }

  // ── Agent Fetch & Assignment ─────────────────────────────────────────────
  fetchAgents(): void {
    this.isLoadingAgents.set(true);
    this.loadAgentsError.set(null);
    this.agentService.getAgents().subscribe({
      next: (res) => {
        // Filter out inactive agents if needed, but getAgents returns all.
        // We will display status badges for active/inactive.
        this.agents.set(res);
        this.isLoadingAgents.set(false);
      },
      error: () => {
        this.loadAgentsError.set('Failed to fetch agents list.');
        this.isLoadingAgents.set(false);
      },
    });
  }

  showAssign(): void {
    this.fetchAgents();
    this.currentView.set('assign');
  }

  assignAgent(agent: Agent): void {
    const delivery = this.selectedDelivery();
    if (!delivery) return;

    this.isAssigning.set(true);
    this.assignError.set(null);

    // Call partial update endpoint in backend
    this.deliveryService
      .updateDelivery(delivery.id, {
        agent: agent.fullname,
        agent_id: agent.id,
        status: 'Assigned',
      })
      .subscribe({
        next: (updated) => {
          this.isAssigning.set(false);
          this.selectedDelivery.set(updated);
          
          // Add system notification
          this.notificationService.addNotification(
            `Delivery ${updated.delivery_id} assigned`,
            `Assigned to agent ${agent.fullname}`,
            'info'
          );

          // Add audit log
          const currentUser = this.authService.currentUser();
          this.auditLogService.addLog(
            'Delivery Agent Assigned',
            'Assignment',
            `Assigned agent "${agent.fullname}" to delivery ${updated.delivery_id}`,
            currentUser?.username || 'dispatcher'
          );

          // Navigate back to details
          this.currentView.set('details');
          this.fetchDeliveries();
          this.fetchAgents();
        },
        error: (err) => {
          this.isAssigning.set(false);
          this.assignError.set(err?.error?.detail || 'Failed to assign agent.');
        },
      });
  }

  reassignDelivery(delivery: Delivery): void {
    this.selectedDelivery.set(delivery);
    this.activeTab.set('deliveries');
    this.showAssign();
  }

  getAgentWorkloadClass(count: number): string {
    if (count >= 5) return 'workload-overloaded';
    if (count >= 3) return 'workload-heavy';
    return 'workload-normal';
  }

  getAgentWorkloadLabel(count: number): string {
    if (count >= 5) return 'Overloaded';
    if (count >= 3) return 'Heavy';
    return 'Normal';
  }

  getTimelineStepClass(step: string): string {
    const delivery = this.selectedDelivery();
    if (!delivery) return 'step-upcoming';
    const currentStatus = delivery.status;
    
    const order = ['Created', 'Assigned', 'Picked Up', 'In Transit', 'Delivered'];
    const stepIdx = order.indexOf(step);
    const currentIdx = order.indexOf(currentStatus);
    
    if (currentStatus === 'Cancelled') {
      return 'step-cancelled';
    }
    if (stepIdx < currentIdx) return 'step-completed';
    if (stepIdx === currentIdx) return 'step-active';
    return 'step-upcoming';
  }

  // ── Create Delivery ──────────────────────────────────────────────────────
  openCreateForm(): void {
    this.createForm.reset({
      priority: 'Normal'
    });
    this.createError.set(null);
    this.createSuccess.set(null);
    this.showCreateForm.set(true);
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
  }

  get f() {
    return this.createForm.controls;
  }

  onCreateSubmit(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const v = this.createForm.value;
    const cleanSenderPhone = v.sender_phone?.replace(/\s+/g, '').replace(/-+/g, '');
    const cleanRecipientPhone = v.recipient_phone?.replace(/\s+/g, '').replace(/-+/g, '');

    if (cleanSenderPhone === cleanRecipientPhone && v.sender_name?.trim().toLowerCase() !== v.recipient_name?.trim().toLowerCase()) {
      this.createError.set('Sender phone and Recipient phone cannot be the same for two different users.');
      return;
    }

    this.isSubmitting.set(true);
    this.createError.set(null);
    this.createSuccess.set(null);

    // Construct standard addresses with pincode for backward compatibility
    const pickup_address = `${v.sender_address!.trim()}, ${v.sender_pincode!.trim()}`;
    const drop_address = `${v.recipient_address!.trim()}, ${v.recipient_pincode!.trim()}`;

    this.deliveryService
      .createDelivery({
        pickup_address,
        drop_address,
        customer_name: v.recipient_name!.trim(), // Receiver name
        customer_phone: v.customer_phone!.trim(),
        notes: v.notes || null,
        recipient_name: v.recipient_name!.trim(),
        recipient_address: v.recipient_address!.trim(),
        recipient_pincode: v.recipient_pincode!.trim(),
        recipient_phone: v.recipient_phone!.trim(),
        sender_name: v.sender_name!.trim(),

        sender_address: v.sender_address!.trim(),
        sender_pincode: v.sender_pincode!.trim(),
        sender_phone: v.sender_phone!.trim(),
        package_description: v.package_description || null,
        package_weight: v.package_weight || null,
        package_dimensions: v.package_dimensions || null,

        priority: v.priority || 'Normal',
        status: 'Created'
      })
      .subscribe({
        next: (created) => {
          this.isSubmitting.set(false);
          this.createSuccess.set(
            `Delivery created — Tracking #${created.tracking_number}`
          );
          this.createForm.reset({
            priority: 'Normal'
          });
          this.page.set(1);
          this.fetchDeliveries();
          
          // Trigger system notification
          this.notificationService.addNotification(
            'New delivery created',
            `Tracking No: ${created.tracking_number}`,
            'success'
          );

          // Add audit log
          const currentUser = this.authService.currentUser();
          this.auditLogService.addLog(
            'Delivery Order Created',
            'User Action',
            `Created delivery ${created.delivery_id} (Tracking: ${created.tracking_number})`,
            currentUser?.username || 'dispatcher'
          );

          setTimeout(() => {
            this.closeCreateForm();
          }, 1500);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const detail = err?.error?.detail;
          this.createError.set(
            Array.isArray(detail)
              ? detail.map((d: any) => d.msg).join(', ')
              : detail || 'Failed to create delivery.'
          );
        },
      });
  }
}
