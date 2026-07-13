import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { MockDataService, Driver, Shipment } from '../../services/mock-data.service';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, Card, Tag, Button],
  templateUrl: './drivers.html',
  styleUrl: './drivers.scss'
})
export class Drivers implements OnInit {
  drivers: Driver[] = [];
  shipments: Shipment[] = [];

  constructor(private mockService: MockDataService) {}

  ngOnInit() {
    this.mockService.getDrivers().subscribe(d => this.drivers = d);
    this.mockService.getShipments().subscribe(s => this.shipments = s);
  }

  getDriverActiveShipment(driverId: string): Shipment | null {
    return this.shipments.find(s => s.driverId === driverId && s.status !== 'Delivered') || null;
  }

  getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'Active': return 'success';
      case 'Idle': return 'info';
      case 'Offline': return 'secondary';
      default: return 'secondary';
    }
  }

  callDriver(name: string) {
    alert(`Calling ${name}...`);
  }

  messageDriver(name: string) {
    alert(`Opening chat with ${name}...`);
  }
}
