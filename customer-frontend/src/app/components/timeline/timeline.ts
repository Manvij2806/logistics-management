import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService, Shipment, Driver } from '../../services/mock-data.service';

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss'
})
export class TimelineView implements OnInit {
  @Output() viewChange = new EventEmitter<string>();

  shipment: Shipment | null = null;
  drivers: Driver[] = [];

  constructor(private mockService: MockDataService) {}

  ngOnInit() {
    this.mockService.getDrivers().subscribe(d => this.drivers = d);

    // Subscribe to shipments to find TRK1234567890 as the featured timeline
    this.mockService.getShipments().subscribe(shipments => {
      const found = shipments.find(s => s.id === 'TRK1234567890');
      if (found) {
        this.shipment = found;
      } else if (shipments.length > 0) {
        this.shipment = shipments[0];
      }
    });
  }

  goBack() {
    this.viewChange.emit('dashboard');
  }

  getAssignedDriver(): Driver | null {
    if (!this.shipment || !this.shipment.driverId) return null;
    return this.drivers.find(d => d.id === this.shipment!.driverId) || null;
  }

  getTimelineSteps(shipment: Shipment): any[] {
    const steps: any[] = [];
    const isTRK90 = shipment.id === 'TRK1234567890';
    const isTRK92 = shipment.id === 'TRK1234567892';

    // Step 1: Order Created
    steps.push({
      title: 'Order Created',
      time: isTRK90 ? '20 May 2024, 09:15 AM' : (isTRK92 ? '20 May 2024, 11:15 AM' : shipment.timeline[0]?.time || '09:15 AM'),
      description: 'Your order has been created',
      status: 'completed',
      icon: 'pi pi-check',
      colorClass: 'completed'
    });

    // Step 2: Assigned to Agent
    const hasAgent = shipment.driverId !== null;
    const driverName = this.getAssignedDriver()?.name || 'Rahul Transport';
    steps.push({
      title: 'Assigned to Agent',
      time: isTRK90 ? '20 May 2024, 09:45 AM' : (isTRK92 ? '20 May 2024, 12:00 PM' : '09:45 AM'),
      description: `${driverName} has been assigned`,
      status: hasAgent ? 'completed' : 'pending',
      icon: 'pi pi-check',
      colorClass: hasAgent ? 'completed' : 'pending'
    });

    // Step 3: Picked Up
    const isPickedUp = shipment.status !== 'Pending';
    steps.push({
      title: 'Picked Up',
      time: isTRK90 ? '20 May 2024, 10:30 AM' : (isTRK92 ? '20 May 2024, 12:00 PM' : '10:30 AM'),
      description: `Package picked up from ${shipment.pickupLocation}`,
      status: isPickedUp ? 'completed' : 'pending',
      icon: 'pi pi-check',
      colorClass: isPickedUp ? 'completed' : 'pending'
    });

    // Step 4: In Transit
    let transitStatus: 'completed' | 'active' | 'pending' = 'pending';
    if (shipment.status === 'In Transit' || shipment.status === 'Delayed') {
      transitStatus = 'active';
    } else if (shipment.status === 'Out for Delivery' || shipment.status === 'Delivered') {
      transitStatus = 'completed';
    }
    steps.push({
      title: 'In Transit',
      time: isTRK90 ? '20 May 2024, 10:30 AM' : (isTRK92 ? '20 May 2024, 12:15 PM' : '10:30 AM'),
      description: 'Package is on the way',
      status: transitStatus,
      icon: 'pi pi-truck',
      colorClass: transitStatus === 'completed' ? 'completed' : (transitStatus === 'active' ? 'transit' : 'pending')
    });

    // Step 5: Out for Delivery
    let outStatus: 'completed' | 'active' | 'pending' = 'pending';
    if (shipment.status === 'Out for Delivery') {
      outStatus = 'active';
    } else if (shipment.status === 'Delivered') {
      outStatus = 'completed';
    }
    steps.push({
      title: 'Out for Delivery',
      time: isTRK90 ? '20 May 2024, 11:30 AM' : (isTRK92 ? '20 May 2024, 01:15 PM' : '11:30 AM'),
      description: 'Package is out for delivery',
      status: outStatus,
      icon: 'pi pi-truck',
      colorClass: outStatus === 'completed' ? 'completed' : (outStatus === 'active' ? 'delivery' : 'pending')
    });

    // Step 6: Delivered
    const isDelivered = shipment.status === 'Delivered';
    steps.push({
      title: 'Delivered',
      time: isDelivered ? (isTRK92 ? '20 May 2024, 01:15 PM' : shipment.lastUpdate) : 'Pending',
      description: isDelivered ? `Package delivered successfully to ${shipment.customer}` : 'Package will be delivered soon',
      status: isDelivered ? 'completed' : 'pending',
      icon: 'pi pi-check',
      colorClass: isDelivered ? 'completed' : 'pending'
    });

    return steps;
  }
}
