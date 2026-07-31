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
      const datePart = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
      const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
    } catch {
      return 'Pending';
    }
  }

  isIntercity(shipment: any): boolean {
    const pLoc = (shipment.pickupLocation || '').toLowerCase();
    const dLoc = (shipment.deliveryLocation || '').toLowerCase();
    
    const parts1 = pLoc.split(',').map((x: string) => x.trim());
    const parts2 = dLoc.split(',').map((x: string) => x.trim());
    
    if (parts1.length >= 2 && parts2.length >= 2) {
      const city1 = parts1[parts1.length - 2];
      const city2 = parts2[parts2.length - 2];
      if (city1 && city2 && city1 !== city2) return true;
    }
    
    const cities = ['delhi', 'noida', 'gurugram', 'gurgaon', 'faridabad', 'ghaziabad', 'agra', 'mumbai', 'bangalore', 'bengaluru', 'chennai', 'kolkata', 'pune', 'hyderabad', 'jaipur', 'lucknow', 'kanpur'];
    const city1 = cities.find(c => pLoc.includes(c));
    const city2 = cities.find(c => dLoc.includes(c));
    if (city1 && city2 && city1 !== city2) return true;
    
    return false;
  }

  getStatusIndex(shipment: any): number {
    if (!shipment || !shipment.status) return 0;
    const s = shipment.status.toLowerCase();
    if (s === 'created' || s === 'pending') return 0;
    if (s === 'picked up') return 1;
    if (s === 'arrived at origin hub') return 2;
    if (s.includes('hub-to-hub')) return 3;
    if (s.includes('destination hub')) return 4;
    if (s === 'assigned') {
      return (shipment.in_transit_at || shipment.picked_up_at) ? 4.5 : 0.5;
    }
    if (s === 'in transit' || s === 'out for delivery') return 5;
    if (s === 'delivered') return 6;
    return 0;
  }

  getLastUpdateTime(shipment: any): string {
    if (shipment.status === 'Delivered') return this.formatTime(shipment.delivered_at);
    if (shipment.status === 'In Transit' || shipment.status === 'Out for Delivery') return this.formatTime(shipment.in_transit_at);
    if (shipment.status === 'Arrived at Destination Hub') return this.formatTime(shipment.in_transit_at);
    if (shipment.status === 'In Transit (Hub-to-Hub)') return this.formatTime(shipment.in_transit_at);
    if (shipment.status === 'Picked Up') return this.formatTime(shipment.picked_up_at);
    if (shipment.status === 'Assigned') return this.formatTime(shipment.assigned_at);
    return this.formatTime(shipment.created_at);
  }

  getTimelineSteps(shipment: any): any[] {
    const steps: any[] = [];
    const idx = this.getStatusIndex(shipment);
    const intercity = this.isIntercity(shipment);

    if (!intercity) {
      // Local Delivery (5 steps)
      steps.push({
        title: 'Order Created',
        time: this.formatTime(shipment.created_at),
        description: 'Your order has been created',
        status: 'completed',
        icon: 'pi pi-check',
        colorClass: 'completed'
      });

      const isAssigned = (idx === 4 || idx === 1 || idx === 5 || idx === 6 || idx === 0.5);
      steps.push({
        title: 'Assigned to Agent',
        time: isAssigned ? this.formatTime(shipment.assigned_at || shipment.created_at) : 'Pending',
        description: isAssigned ? `${shipment.agent || 'Agent'} has been assigned` : 'Awaiting agent assignment',
        status: isAssigned ? 'completed' : 'pending',
        icon: 'pi pi-user',
        colorClass: isAssigned ? 'completed' : 'pending'
      });

      const isPickedUp = (idx === 1 || idx === 5 || idx === 6);
      steps.push({
        title: 'Picked Up',
        time: isPickedUp ? this.formatTime(shipment.picked_up_at || shipment.assigned_at || shipment.created_at) : 'Pending',
        description: isPickedUp ? 'Package picked up from source' : 'Awaiting pickup',
        status: isPickedUp ? 'completed' : 'pending',
        icon: 'pi pi-box',
        colorClass: isPickedUp ? 'completed' : 'pending'
      });

      let transitStatus: 'completed' | 'active' | 'pending' = 'pending';
      if (idx === 5) transitStatus = 'active';
      else if (idx === 6) transitStatus = 'completed';
      steps.push({
        title: 'Out for Delivery',
        time: (transitStatus === 'completed' || transitStatus === 'active') ? this.formatTime(shipment.in_transit_at || shipment.picked_up_at || shipment.created_at) : 'Pending',
        description: 'Package is on the way to your doorstep',
        status: transitStatus,
        icon: 'pi pi-truck',
        colorClass: transitStatus === 'completed' ? 'completed' : (transitStatus === 'active' ? 'transit' : 'pending')
      });

      const isDelivered = idx === 6;
      steps.push({
        title: 'Delivered',
        time: isDelivered ? this.formatTime(shipment.delivered_at || shipment.in_transit_at || shipment.created_at) : 'Pending',
        description: isDelivered ? 'Package delivered successfully' : 'Package will be delivered soon',
        status: isDelivered ? 'completed' : 'pending',
        icon: 'pi pi-check-circle',
        colorClass: isDelivered ? 'completed' : 'pending'
      });
    } else {
      // Long-Distance Delivery (8 steps)
      steps.push({
        title: 'Order Created',
        time: this.formatTime(shipment.created_at),
        description: 'Your order has been created',
        status: 'completed',
        icon: 'pi pi-check',
        colorClass: 'completed'
      });

      const isAssigned = (idx >= 1 || idx === 4 || idx === 0.5);
      steps.push({
        title: 'Pickup Agent Assigned',
        time: isAssigned ? this.formatTime(shipment.assigned_at || shipment.created_at) : 'Pending',
        description: isAssigned ? 'Pickup agent assigned to fetch parcel' : 'Awaiting pickup assignment',
        status: isAssigned ? 'completed' : 'pending',
        icon: 'pi pi-user',
        colorClass: isAssigned ? 'completed' : 'pending'
      });

      const isPickedUp = (idx >= 1 && idx !== 4 && idx !== 0.5);
      steps.push({
        title: 'Picked Up for Hub Transit',
        time: isPickedUp ? this.formatTime(shipment.picked_up_at || shipment.assigned_at || shipment.created_at) : 'Pending',
        description: isPickedUp ? 'Package picked up from source' : 'Awaiting pickup',
        status: isPickedUp ? 'completed' : 'pending',
        icon: 'pi pi-box',
        colorClass: isPickedUp ? 'completed' : 'pending'
      });

      const arrivedOrigin = idx >= 2;
      steps.push({
        title: 'Arrived at Origin Hub',
        time: arrivedOrigin ? this.formatTime(shipment.picked_up_at || shipment.assigned_at || shipment.created_at) : 'Pending',
        description: arrivedOrigin ? 'Package received at origin sorting facility' : 'Awaiting origin hub arrival',
        status: arrivedOrigin ? 'completed' : 'pending',
        icon: 'pi pi-home',
        colorClass: arrivedOrigin ? 'completed' : 'pending'
      });

      let transitStatus: 'completed' | 'active' | 'pending' = 'pending';
      if (idx === 3) transitStatus = 'active';
      else if (idx > 3) transitStatus = 'completed';
      steps.push({
        title: 'In Hub-to-Hub Transit',
        time: (transitStatus === 'completed' || transitStatus === 'active') ? this.formatTime(shipment.in_transit_at || shipment.picked_up_at || shipment.created_at) : 'Pending',
        description: transitStatus === 'active' ? 'Package is in transit between states/cities' : (transitStatus === 'completed' ? 'Package completed intercity transit' : 'Awaiting dispatch'),
        status: transitStatus,
        icon: 'pi pi-truck',
        colorClass: transitStatus === 'completed' ? 'completed' : (transitStatus === 'active' ? 'transit' : 'pending')
      });

      let destHubStatus: 'completed' | 'active' | 'pending' = 'pending';
      if (idx === 4) destHubStatus = 'active';
      else if (idx > 4) destHubStatus = 'completed';
      steps.push({
        title: 'Arrived at Destination Hub',
        time: (destHubStatus === 'completed' || destHubStatus === 'active') ? this.formatTime(shipment.in_transit_at || shipment.picked_up_at || shipment.created_at) : 'Pending',
        description: destHubStatus === 'active' ? 'Package received at receiver city facility' : (destHubStatus === 'completed' ? 'Arrived at destination city hub' : 'Awaiting arrival at destination hub'),
        status: destHubStatus,
        icon: 'pi pi-building',
        colorClass: destHubStatus === 'completed' ? 'completed' : (destHubStatus === 'active' ? 'transit' : 'pending')
      });

      const deliveryAssigned = idx >= 4.5;
      steps.push({
        title: 'Local Delivery Agent Assigned',
        time: deliveryAssigned ? this.formatTime(shipment.assigned_at || shipment.in_transit_at || shipment.created_at) : 'Pending',
        description: deliveryAssigned ? `${shipment.agent || 'Local agent'} assigned for doorstep delivery` : 'Awaiting final delivery assignment',
        status: deliveryAssigned ? 'completed' : 'pending',
        icon: 'pi pi-user',
        colorClass: deliveryAssigned ? 'completed' : 'pending'
      });

      let localDeliveryStatus: 'completed' | 'active' | 'pending' = 'pending';
      if (idx === 5) localDeliveryStatus = 'active';
      else if (idx === 6) localDeliveryStatus = 'completed';
      steps.push({
        title: 'Out for Delivery',
        time: (localDeliveryStatus === 'completed' || localDeliveryStatus === 'active') ? this.formatTime(shipment.in_transit_at || shipment.assigned_at || shipment.created_at) : 'Pending',
        description: 'Package is on the way to your doorstep',
        status: localDeliveryStatus,
        icon: 'pi pi-truck',
        colorClass: localDeliveryStatus === 'completed' ? 'completed' : (localDeliveryStatus === 'active' ? 'transit' : 'pending')
      });

      const isDelivered = idx === 6;
      steps.push({
        title: 'Delivered',
        time: isDelivered ? this.formatTime(shipment.delivered_at || shipment.in_transit_at || shipment.created_at) : 'Pending',
        description: isDelivered ? 'Package delivered successfully' : 'Package will be delivered soon',
        status: isDelivered ? 'completed' : 'pending',
        icon: 'pi pi-check-circle',
        colorClass: isDelivered ? 'completed' : 'pending'
      });
    }

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
