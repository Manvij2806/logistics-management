import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DeliveryService, Delivery } from '../../services/delivery.service';
import { ShipmentDetails } from '../shipment-details/shipment-details';

@Component({
  selector: 'app-shipments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    Button,
    Tag,
    InputText,
    Select,
    ShipmentDetails
  ],
  templateUrl: './shipments.html',
  styleUrl: './shipments.scss'
})
export class Shipments implements OnInit {
  shipments: Delivery[] = [];
  filteredShipments: Delivery[] = [];
  
  searchText: string = '';
  selectedStatus: string = 'All';
  
  statusOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Assigned', value: 'Assigned' },
    { label: 'Picked Up', value: 'Picked Up' },
    { label: 'In Transit', value: 'In Transit' },
    { label: 'Delivered', value: 'Delivered' },
    { label: 'Cancelled', value: 'Cancelled' }
  ];

  detailsVisible: boolean = false;
  selectedShipmentForDetails: Delivery | null = null;

  constructor(private deliveryService: DeliveryService) {}

  ngOnInit() {
    this.fetchDeliveries();
  }

  fetchDeliveries() {
    this.deliveryService.getDeliveries({ page_size: 100 }).subscribe({
      next: (res) => {
        this.shipments = res.deliveries;
        this.filterShipments();
        
        if (this.selectedShipmentForDetails) {
          const updated = res.deliveries.find(ship => ship.id === this.selectedShipmentForDetails!.id);
          if (updated) this.selectedShipmentForDetails = updated;
        }
      },
      error: (err) => {
        console.error('Error fetching deliveries in shipments view', err);
      }
    });
  }

  filterShipments() {
    this.filteredShipments = this.shipments.filter(s => {
      const matchesSearch = s.delivery_id.toLowerCase().includes(this.searchText.toLowerCase()) ||
                            s.pickup_address.toLowerCase().includes(this.searchText.toLowerCase()) ||
                            s.drop_address.toLowerCase().includes(this.searchText.toLowerCase()) ||
                            (s.agent && s.agent.toLowerCase().includes(this.searchText.toLowerCase()));
      
      const matchesStatus = this.selectedStatus === 'All' || s.status === this.selectedStatus;
      
      return (matchesSearch || !this.searchText) && matchesStatus;
    });
  }

  onSearchChange() {
    this.filterShipments();
  }

  onStatusChange() {
    this.filterShipments();
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

  getPaymentSeverity(paymentStatus: string | undefined): 'success' | 'danger' | 'secondary' {
    if (paymentStatus === 'Paid') return 'success';
    if (paymentStatus === 'Unpaid') return 'danger';
    return 'secondary';
  }

  openDetails(shipment: Delivery) {
    this.selectedShipmentForDetails = shipment;
    this.detailsVisible = true;
  }
}

