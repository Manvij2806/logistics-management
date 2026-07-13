import { Component, OnInit } from '@angular/core';
import { DeliveryService } from '../services/delivery.service';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  constructor(private deliveryService: DeliveryService) {}

  ngOnInit(): void {
    this.deliveryService.loadAgentDeliveries();
  }
}
