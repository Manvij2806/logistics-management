import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService, SystemAlert } from '../../services/mock-data.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class Notifications implements OnInit {
  @Output() trackShipment = new EventEmitter<string>();

  notifications: SystemAlert[] = [];

  constructor(private mockService: MockDataService) {}

  ngOnInit() {
    this.mockService.getAlerts().subscribe(alerts => {
      this.notifications = alerts;
    });
  }

  getIcon(type: string): string {
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

  markAllAsRead() {
    this.mockService.markAllAlertsAsRead();
  }

  markAsRead(id: string) {
    this.mockService.markAlertAsRead(id);
    const alert = this.notifications.find(n => n.id === id);
    if (alert && alert.shipmentId) {
      this.trackShipment.emit(alert.shipmentId);
    }
  }

  loadMore() {
    alert('Loading older notifications...');
  }
}
