import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { DeliveryService } from '../../services/delivery.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-track-delivery',
  standalone: true,
  imports: [CommonModule, FormsModule, InputText, Button, Tag],
  templateUrl: './track-delivery.html',
  styleUrl: './track-delivery.scss'
})
export class TrackDelivery implements OnInit, OnDestroy {
  private deliveryService = inject(DeliveryService);

  @Input() set searchTrackingId(val: string) {
    if (val) {
      this.trackingId = val;
      this.trackNow();
    }
  }
  @Output() searchTrackingIdChange = new EventEmitter<string>();

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLElement>;

  trackingId: string = '';
  isTracking: boolean = false;
  shipment: any = null;
  errorMessage: string = '';

  private map: L.Map | undefined;
  private mapInitTimeout: any;

  ngOnInit() {
    if (this.trackingId) {
      this.trackNow();
    }
  }

  trackNow() {
    if (!this.trackingId.trim()) {
      this.errorMessage = 'Please enter a Tracking ID.';
      return;
    }

    this.deliveryService.getDeliveries({ page_size: 100 }).subscribe({
      next: (res) => {
        const found = res.deliveries.find(
          s => s.delivery_id.toLowerCase() === this.trackingId.trim().toLowerCase() ||
               (s.tracking_number && s.tracking_number.toLowerCase() === this.trackingId.trim().toLowerCase())
        );

        if (found) {
          this.shipment = {
            id: found.delivery_id,
            status: found.status,
             eta: found.status === 'Delivered' ? 'Delivered' : 
                  (found.estimated_delivery_at ? new Date(found.estimated_delivery_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'ETA: 18:00'),
             estimated_delivery_at: found.estimated_delivery_at,
             distanceLeft: found.status === 'Delivered' ? 0 : 5,
            pickupLocation: found.pickup_address,
            deliveryLocation: found.drop_address,
            pickupCoords: { x: 120, y: 150 },
            destCoords: { x: 380, y: 320 },
            currentCoords: { x: 250, y: 235 },
            timeline: [
              { status: 'Created', time: '10:00 AM' },
              { status: found.status, time: '10:30 AM' }
            ],
            driverId: found.agent ? 'agent-1' : null,
            agentName: found.agent,
            tracking_number: found.tracking_number,
            created_at: found.created_at,
            assigned_at: found.assigned_at,
            picked_up_at: found.picked_up_at,
            in_transit_at: found.in_transit_at,
            delivered_at: found.delivered_at,
          };
          this.isTracking = true;
          this.errorMessage = '';

          this.destroyMap();
          this.mapInitTimeout = setTimeout(() => {
            this.initMap();
          }, 300);
        } else {
          this.errorMessage = `No shipment found with ID: ${this.trackingId}`;
          this.isTracking = false;
          this.shipment = null;
        }
      },
      error: () => {
        this.errorMessage = 'Failed to load tracking details.';
        this.isTracking = false;
        this.shipment = null;
      }
    });
  }

  clearSearch() {
    this.trackingId = '';
    this.errorMessage = '';
  }

  goBack() {
    this.destroyMap();
    this.isTracking = false;
    this.errorMessage = '';
    this.searchTrackingIdChange.emit('');
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  private destroyMap() {
    if (this.mapInitTimeout) {
      clearTimeout(this.mapInitTimeout);
    }
    if (this.map) {
      try {
        this.map.remove();
      } catch (_) {}
      this.map = undefined;
    }
  }

  getAssignedDriver() {
    if (!this.shipment || !this.shipment.agentName) return null;
    return {
      name: this.shipment.agentName,
      rating: 4.8,
      vehicleType: 'Assigned Agent',
      avatarColor: '#6366f1'
    };
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

  formatTime(dateStr: string | null | undefined): string {
    if (!dateStr) return 'Pending';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return 'Pending';
    }
  }

  getTimelineSteps(shipment: any): any[] {
    const steps: any[] = [];

    // Step 1: Order Created
    steps.push({
      title: 'Order Created',
      time: this.formatTime(shipment.created_at),
      description: 'Your order has been created',
      status: 'completed',
      icon: 'pi pi-check',
      colorClass: 'completed'
    });

    // Step 2: Assigned to Agent
    const hasAgent = !!shipment.agentName;
    const isAssigned = ['Assigned', 'Picked Up', 'In Transit', 'Delivered'].includes(shipment.status);
    steps.push({
      title: 'Assigned to Agent',
      time: isAssigned ? this.formatTime(shipment.assigned_at) : 'Pending',
      description: hasAgent ? `${shipment.agentName} has been assigned` : 'Awaiting agent assignment',
      status: isAssigned ? 'completed' : 'pending',
      icon: 'pi pi-check',
      colorClass: isAssigned ? 'completed' : 'pending'
    });

    // Step 3: Picked Up
    const isPickedUp = ['Picked Up', 'In Transit', 'Delivered'].includes(shipment.status);
    steps.push({
      title: 'Picked Up',
      time: isPickedUp ? this.formatTime(shipment.picked_up_at) : 'Pending',
      description: isPickedUp ? 'Package picked up from source' : 'Awaiting pickup',
      status: isPickedUp ? 'completed' : 'pending',
      icon: 'pi pi-check',
      colorClass: isPickedUp ? 'completed' : 'pending'
    });

    // Step 4: In Transit
    let transitStatus: 'completed' | 'active' | 'pending' = 'pending';
    if (shipment.status === 'In Transit') {
      transitStatus = 'active';
    } else if (shipment.status === 'Delivered') {
      transitStatus = 'completed';
    }
    steps.push({
      title: 'In Transit',
      time: (transitStatus === 'completed' || transitStatus === 'active') ? this.formatTime(shipment.in_transit_at) : 'Pending',
      description: 'Package is on the way',
      status: transitStatus,
      icon: 'pi pi-truck',
      colorClass: transitStatus === 'completed' ? 'completed' : (transitStatus === 'active' ? 'transit' : 'pending')
    });

    // Step 5: Delivered
    const isDelivered = shipment.status === 'Delivered';
    steps.push({
      title: 'Delivered',
      time: isDelivered ? this.formatTime(shipment.delivered_at) : 'Pending',
      description: isDelivered ? `Package delivered successfully` : 'Package will be delivered soon',
      status: isDelivered ? 'completed' : 'pending',
      icon: 'pi pi-check',
      colorClass: isDelivered ? 'completed' : 'pending'
    });

    return steps;
  }

  callDriver(name: string) {
    alert(`Calling driver ${name}...`);
  }

  messageDriver(name: string) {
    alert(`Opening chat with ${name}...`);
  }

  private initMap(): void {
    const container = this.mapContainer?.nativeElement;
    if (!container) return;

    if ((container as any)._leaflet_id) {
      return;
    }

    const pickupCoords = this.deliveryService.getCoords(this.shipment.pickupLocation);
    const dropoffCoords = this.deliveryService.getCoords(this.shipment.deliveryLocation);

    try {
      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(this.map);

      const pickupIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <span class="material-icons" style="color: #2196f3; font-size: 28px; width: 28px; height: 28px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">location_on</span>
            <span style="font-size: 11px; font-weight: 600; color: #1a2744; background: white; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); white-space: nowrap; margin-top: 2px; font-family: 'Roboto', sans-serif;">Pickup</span>
          </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 28],
      });

      const dropoffIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <span class="material-icons" style="color: #f44336; font-size: 28px; width: 28px; height: 28px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">flag</span>
            <span style="font-size: 11px; font-weight: 600; color: #1a2744; background: white; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); white-space: nowrap; margin-top: 2px; font-family: 'Roboto', sans-serif;">Drop-off</span>
          </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 28],
      });

      L.marker(pickupCoords, { icon: pickupIcon }).addTo(this.map);
      L.marker(dropoffCoords, { icon: dropoffIcon }).addTo(this.map);

      L.polyline([pickupCoords, dropoffCoords], {
        color: '#5b9aff',
        weight: 4,
        dashArray: '10, 10',
        opacity: 0.8,
      }).addTo(this.map);

      const bounds = L.latLngBounds([pickupCoords, dropoffCoords]);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    } catch (e) {
      console.error('Error inside initMap:', e);
      this.destroyMap();
    }
  }
}
