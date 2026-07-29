import { Component, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeliveryService } from '../../services/delivery.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss'
})
export class TopbarComponent implements OnInit {
  private elementRef = inject(ElementRef);
  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);

  showNotifications = false;
  notifications: any[] = [];

  ngOnInit() {
    this.loadNotifications();
  }

  getReadIds(): number[] {
    const val = localStorage.getItem('readNotificationIds');
    return val ? JSON.parse(val) : [];
  }

  loadNotifications() {
    this.deliveryService.getDeliveries().subscribe({
      next: (res) => {
        // Sort by database ID descending (newest first)
        const sorted = [...res].sort((a, b) => b.id - a.id);
        
        let readIds = this.getReadIds();
        const initialized = localStorage.getItem('notifications_initialized');
        
        if (!initialized && sorted.length > 0) {
          // Initialize read state by marking all except first 4 as read (giving exactly 4 unread)
          readIds = sorted.slice(4).map(d => d.id);
          localStorage.setItem('readNotificationIds', JSON.stringify(readIds));
          localStorage.setItem('notifications_initialized', 'true');
        }

        const mockTimes = ['Just Now', '5 Minutes Ago', '2 Hours Ago', 'Yesterday', 'Yesterday', 'Yesterday', 'Yesterday', 'Yesterday'];

        this.notifications = sorted.map((d, index) => {
          const isUnread = !readIds.includes(d.id);
          const time = mockTimes[index] || 'Yesterday';

          let title = '';
          let message = '';
          let icon = '';
          let color = '';

          switch (d.status) {
            case 'Created':
            case 'Pending':
              title = 'Pending Assignment';
              message = `New delivery ${d.delivery_id} is pending assignment.`;
              icon = 'pi pi-clock';
              color = '#f59e0b';
              break;
            case 'Assigned':
              // Alternate title style for Assigned vs Reassigned
              if (d.id % 2 === 0) {
                title = 'Delivery Assigned';
                message = `Delivery ${d.delivery_id} has been assigned to ${d.agent || 'an agent'}.`;
                icon = 'pi pi-user-plus';
                color = '#1F57F5';
              } else {
                title = 'Reassigned';
                message = `Delivery ${d.delivery_id} has been reassigned to ${d.agent || 'an agent'}.`;
                icon = 'pi pi-sync';
                color = '#8b5cf6';
              }
              break;
            case 'Picked Up':
              title = 'Picked Up';
              message = `Shipment ${d.delivery_id} has been picked up.`;
              icon = 'pi pi-shopping-bag';
              color = '#6366f1';
              break;
            case 'In Transit':
              title = 'In Transit';
              message = `Order ${d.delivery_id} is now in transit.`;
              icon = 'pi pi-truck';
              color = '#0ea5e9';
              break;
            case 'Delivered':
              title = 'Delivered';
              message = `Delivery ${d.delivery_id} was successfully delivered.`;
              icon = 'pi pi-check-circle';
              color = '#10b981';
              break;
            case 'Cancelled':
              title = 'Cancelled';
              message = `Delivery ${d.delivery_id} has been cancelled.`;
              icon = 'pi pi-times-circle';
              color = '#ef4444';
              break;
            case 'Arrived at Destination Hub':
              title = 'Arrived at Destination Hub';
              message = `Delivery ${d.delivery_id} has arrived at the destination hub. Please assign a delivery agent.`;
              icon = 'pi pi-building';
              color = '#10b981';
              break;
            default:
              title = 'Status Update';
              message = `Delivery ${d.delivery_id} status is ${d.status}.`;
              icon = 'pi pi-info-circle';
              color = '#64748b';
          }

          return {
            id: d.id,
            dbId: d.id,
            title,
            message,
            time,
            unread: isUnread,
            icon,
            color
          };
        });
      },
      error: (err) => {
        console.error('Error loading real notifications', err);
      }
    });
  }

  get unreadCount(): number {
    return this.notifications.filter(n => n.unread).length;
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
  }

  markAllAsRead(event: Event) {
    event.stopPropagation();
    const readIds = this.getReadIds();
    this.notifications.forEach(n => {
      n.unread = false;
      if (!readIds.includes(n.dbId)) {
        readIds.push(n.dbId);
      }
    });
    localStorage.setItem('readNotificationIds', JSON.stringify(readIds));
  }

  markAsRead(n: any) {
    n.unread = false;
    const readIds = this.getReadIds();
    if (!readIds.includes(n.dbId)) {
      readIds.push(n.dbId);
      localStorage.setItem('readNotificationIds', JSON.stringify(readIds));
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showNotifications = false;
    }
  }

  getUserName(): string {
    return this.authService.currentUser()?.full_name || 'Dispatcher';
  }

  getUserRole(): string {
    return this.authService.currentUser()?.role || 'Dispatcher';
  }

  getUserInitials(): string {
    const name = this.getUserName();
    if (!name) return 'D';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
