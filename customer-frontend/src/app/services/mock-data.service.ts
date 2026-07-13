import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Driver {
  id: string;
  name: string;
  rating: number;
  status: 'Active' | 'Idle' | 'Offline';
  phone: string;
  vehicleType: string;
  avatarColor: string;
}

export interface TimelineEvent {
  status: string;
  time: string;
  details?: string;
}

export interface Shipment {
  id: string;
  customer: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupCoords: { x: number; y: number };
  destCoords: { x: number; y: number };
  currentCoords: { x: number; y: number };
  progress: number; // 0 to 100
  speed: number; // km/h
  distanceLeft: number; // km
  eta: string;
  lastUpdate: string;
  status: 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Pending' | 'Delayed';
  driverId: string | null;
  timeline: TimelineEvent[];
}

export interface SystemAlert {
  id: string;
  type: 'delay' | 'success' | 'sos' | 'assignment' | 'transit' | 'delivery' | 'created';
  message: string;
  time: string;
  shipmentId?: string;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private driversSubject = new BehaviorSubject<Driver[]>([
    { id: 'DRV001', name: 'Rahul Transport', rating: 4.8, status: 'Active', phone: '+91 98765 43210', vehicleType: 'Electric Van', avatarColor: '#6366f1' },
    { id: 'DRV002', name: 'Vikram Singh', rating: 4.6, status: 'Idle', phone: '+91 98765 43211', vehicleType: 'Heavy Truck', avatarColor: '#10b981' },
    { id: 'DRV003', name: 'Amit Sharma', rating: 4.9, status: 'Idle', phone: '+91 98765 43212', vehicleType: 'Electric Van', avatarColor: '#f59e0b' },
    { id: 'DRV004', name: 'Neha Gupta', rating: 4.7, status: 'Idle', phone: '+91 98765 43213', vehicleType: 'Courier Bike', avatarColor: '#ec4899' },
    { id: 'DRV005', name: 'Rajesh Kumar', rating: 4.5, status: 'Offline', phone: '+91 98765 43214', vehicleType: 'Box Truck', avatarColor: '#6b7280' }
  ]);

  private shipmentsSubject = new BehaviorSubject<Shipment[]>([
    {
      id: 'TRK1234567890',
      customer: 'Neha',
      pickupLocation: 'Connaught Place, New Delhi',
      deliveryLocation: 'Saket, New Delhi',
      pickupCoords: { x: 120, y: 150 },
      destCoords: { x: 380, y: 320 },
      currentCoords: { x: 250, y: 235 },
      progress: 50,
      speed: 42,
      distanceLeft: 6.2,
      eta: '20 May 2026, 12:45 PM',
      lastUpdate: '20 May 2026, 10:30 AM',
      status: 'In Transit',
      driverId: 'DRV001',
      timeline: [
        { status: 'Order Placed', time: '09:00 AM', details: 'Order received by LogisticsPro system' },
        { status: 'Package Picked Up', time: '10:00 AM', details: 'Picked up from Connaught Place, New Delhi' },
        { status: 'In Transit', time: '10:30 AM', details: 'On route via Outer Ring Road' }
      ]
    },
    {
      id: 'TRK1234567892',
      customer: 'Dwarka Client',
      pickupLocation: 'Dwarka, New Delhi',
      deliveryLocation: 'Rohini, New Delhi',
      pickupCoords: { x: 80, y: 350 },
      destCoords: { x: 180, y: 80 },
      currentCoords: { x: 180, y: 80 },
      progress: 100,
      speed: 0,
      distanceLeft: 0,
      eta: '20 May 2026, 02:30 PM',
      lastUpdate: '20 May 2026, 01:15 PM',
      status: 'Delivered',
      driverId: 'DRV002',
      timeline: [
        { status: 'Order Placed', time: '11:15 AM', details: 'Order received by LogisticsPro system' },
        { status: 'Package Picked Up', time: '12:00 PM', details: 'Picked up from Dwarka, New Delhi' },
        { status: 'Delivered', time: '01:15 PM', details: 'Delivered to Rohini, New Delhi' }
      ]
    },
    {
      id: 'TRK1234567888',
      customer: 'Aarav',
      pickupLocation: 'Karol Bagh, New Delhi',
      deliveryLocation: 'Noida Sector 62',
      pickupCoords: { x: 200, y: 190 },
      destCoords: { x: 480, y: 250 },
      currentCoords: { x: 480, y: 250 },
      progress: 100,
      speed: 0,
      distanceLeft: 0,
      eta: '18 May 2026, 04:10 PM',
      lastUpdate: '18 May 2026, 04:05 PM',
      status: 'Delivered',
      driverId: 'DRV003',
      timeline: [
        { status: 'Order Placed', time: '02:00 PM', details: 'Order received' },
        { status: 'Package Picked Up', time: '02:45 PM', details: 'Picked up from Karol Bagh' },
        { status: 'In Transit', time: '03:15 PM', details: 'On route via DND Flyway' },
        { status: 'Delivered', time: '04:05 PM', details: 'Delivered to recipient. Signed by Aarav' }
      ]
    },
    {
      id: 'TRK1234567885',
      customer: 'Priya',
      pickupLocation: 'Vasant Kunj, New Delhi',
      deliveryLocation: 'Gurugram Phase 3',
      pickupCoords: { x: 100, y: 420 },
      destCoords: { x: 50, y: 480 },
      currentCoords: { x: 50, y: 480 },
      progress: 100,
      speed: 0,
      distanceLeft: 0,
      eta: '15 May 2026, 01:15 PM',
      lastUpdate: '15 May 2026, 01:05 PM',
      status: 'Delivered',
      driverId: 'DRV004',
      timeline: [
        { status: 'Order Placed', time: '11:00 AM', details: 'Order received' },
        { status: 'Package Picked Up', time: '11:45 AM', details: 'Picked up' },
        { status: 'Delivered', time: '01:05 PM', details: 'Delivered' }
      ]
    },
    {
      id: 'TRK1234567895',
      customer: 'Rajiv',
      pickupLocation: 'Chandni Chowk, New Delhi',
      deliveryLocation: 'Mayur Vihar, New Delhi',
      pickupCoords: { x: 260, y: 100 },
      destCoords: { x: 420, y: 210 },
      currentCoords: { x: 260, y: 100 },
      progress: 0,
      speed: 0,
      distanceLeft: 12.8,
      eta: '20 May 2026, 05:30 PM',
      lastUpdate: '20 May 2026, 02:00 PM',
      status: 'Pending',
      driverId: null,
      timeline: [
        { status: 'Order Placed', time: '02:00 PM', details: 'Order registered. Awaiting driver assignment.' }
      ]
    },
    {
      id: 'TRK1234567899',
      customer: 'Deepak',
      pickupLocation: 'South Ext, New Delhi',
      deliveryLocation: 'Faridabad Sector 15',
      pickupCoords: { x: 300, y: 350 },
      destCoords: { x: 400, y: 490 },
      currentCoords: { x: 400, y: 490 },
      progress: 100,
      speed: 0,
      distanceLeft: 0,
      eta: '20 May 2026, 06:15 PM',
      lastUpdate: '20 May 2026, 03:00 PM',
      status: 'Delivered',
      driverId: 'DRV002',
      timeline: [
        { status: 'Order Placed', time: '01:30 PM', details: 'Order registered' },
        { status: 'Package Picked Up', time: '02:30 PM', details: 'Picked up' },
        { status: 'Delivered', time: '03:00 PM', details: 'Delivered' }
      ]
    }
  ]);

  private alertsSubject = new BehaviorSubject<SystemAlert[]>([
    { id: 'ALT001', type: 'transit', message: 'Your package is in transit', time: '20 May 2026, 10:30 AM', shipmentId: 'TRK1234567890', read: false },
    { id: 'ALT002', type: 'delivery', message: 'Out for delivery', time: '20 May 2026, 10:15 AM', shipmentId: 'TRK1234567892', read: false },
    { id: 'ALT003', type: 'success', message: 'Delivered successfully', time: '18 May 2026, 02:45 PM', shipmentId: 'TRK1234567888', read: true },
    { id: 'ALT004', type: 'assignment', message: 'Agent assigned', time: '20 May 2026, 09:45 AM', shipmentId: 'TRK1234567890', read: true },
    { id: 'ALT005', type: 'created', message: 'Order created', time: '20 May 2026, 09:15 AM', shipmentId: 'TRK1234567890', read: true },
    { id: 'ALT006', type: 'delay', message: 'Delay in delivery', time: '15 May 2026, 05:20 PM', shipmentId: 'TRK1234567885', read: true }
  ]);

  private simIntervalId: any = null;

  constructor() {
    this.startSimulation();
  }

  getDrivers(): Observable<Driver[]> {
    return this.driversSubject.asObservable();
  }

  getShipments(): Observable<Shipment[]> {
    return this.shipmentsSubject.asObservable();
  }

  getAlerts(): Observable<SystemAlert[]> {
    return this.alertsSubject.asObservable();
  }

  assignDriver(shipmentId: string, driverId: string): void {
    const shipments = [...this.shipmentsSubject.value];
    const drivers = [...this.driversSubject.value];
    
    const shipmentIndex = shipments.findIndex(s => s.id === shipmentId);
    const driverIndex = drivers.findIndex(d => d.id === driverId);
    
    if (shipmentIndex !== -1 && driverIndex !== -1) {
      const driver = drivers[driverIndex];
      const shipment = shipments[shipmentIndex];
      
      // Update shipment
      shipment.driverId = driverId;
      shipment.status = 'In Transit';
      shipment.progress = 5;
      shipment.speed = 35;
      shipment.currentCoords = { ...shipment.pickupCoords };
      
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      shipment.timeline.push({
        status: 'Driver Assigned',
        time: timeString,
        details: `Assigned to driver ${driver.name}`
      });
      shipment.lastUpdate = `${now.getDate()} May 2026, ${timeString}`;
      
      // Update driver status
      driver.status = 'Active';
      
      // Add system alert
      this.addAlert(`Driver ${driver.name} assigned to shipment ${shipmentId}.`, 'assignment', shipmentId);
      
      this.shipmentsSubject.next(shipments);
      this.driversSubject.next(drivers);
    }
  }

  cancelShipment(shipmentId: string): void {
    const shipments = [...this.shipmentsSubject.value];
    const drivers = [...this.driversSubject.value];
    const shipmentIndex = shipments.findIndex(s => s.id === shipmentId);
    
    if (shipmentIndex !== -1) {
      const shipment = shipments[shipmentIndex];
      const driverId = shipment.driverId;
      
      // Remove shipment
      shipments.splice(shipmentIndex, 1);
      
      // If there was an active driver, make them idle
      if (driverId) {
        const driverIndex = drivers.findIndex(d => d.id === driverId);
        if (driverIndex !== -1) {
          drivers[driverIndex].status = 'Idle';
        }
      }
      
      this.addAlert(`Shipment ${shipmentId} has been cancelled by customer.`, 'sos', shipmentId);
      this.shipmentsSubject.next(shipments);
      this.driversSubject.next(drivers);
    }
  }

  addAlert(message: string, type: 'delay' | 'success' | 'sos' | 'assignment' | 'transit' | 'delivery' | 'created', shipmentId?: string): void {
    const alerts = [...this.alertsSubject.value];
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    alerts.unshift({
      id: `ALT${Math.floor(Math.random() * 10000)}`,
      type,
      message,
      time: timeString,
      shipmentId,
      read: false
    });
    
    this.alertsSubject.next(alerts);
  }

  markAlertAsRead(alertId: string): void {
    const alerts = this.alertsSubject.value.map(a => 
      a.id === alertId ? { ...a, read: true } : a
    );
    this.alertsSubject.next(alerts);
  }

  markAllAlertsAsRead(): void {
    const alerts = this.alertsSubject.value.map(a => ({ ...a, read: true }));
    this.alertsSubject.next(alerts);
  }

  private startSimulation(): void {
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
    }
    
    this.simIntervalId = setInterval(() => {
      let shipmentsUpdated = false;
      let driversUpdated = false;
      
      const shipments = this.shipmentsSubject.value.map(s => {
        if (s.status === 'In Transit' || s.status === 'Out for Delivery' || s.status === 'Delayed') {
          shipmentsUpdated = true;
          
          let step = 1.5;
          if (s.status === 'Delayed') {
            step = 0.3;
            s.speed = Math.floor(Math.random() * 5) + 5;
          } else {
            s.speed = Math.floor(Math.random() * 15) + 35;
          }
          
          const newProgress = Math.min(100, s.progress + step);
          
          // Interpolate coordinates
          const x = s.pickupCoords.x + (s.destCoords.x - s.pickupCoords.x) * (newProgress / 100);
          const y = s.pickupCoords.y + (s.destCoords.y - s.pickupCoords.y) * (newProgress / 100);
          
          let newStatus: Shipment['status'] = s.status;
          let distanceLeft = Math.max(0, +(s.distanceLeft - (step * 0.15)).toFixed(1));
          
          const now = new Date();
          const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const timeline = [...s.timeline];
          
          if (newProgress >= 100) {
            newStatus = 'Delivered';
            distanceLeft = 0;
            s.speed = 0;
            timeline.push({
              status: 'Delivered',
              time: timeString,
              details: `Package delivered successfully to ${s.customer}`
            });
            
            // Release driver
            if (s.driverId) {
              const drivers = [...this.driversSubject.value];
              const dIndex = drivers.findIndex(d => d.id === s.driverId);
              if (dIndex !== -1) {
                drivers[dIndex].status = 'Idle';
                driversUpdated = true;
                this.driversSubject.next(drivers);
              }
            }
            
            this.addAlert(`Shipment ${s.id} delivered successfully to ${s.customer}.`, 'success', s.id);
          } else if (newProgress > 75 && s.status === 'In Transit') {
            newStatus = 'Out for Delivery';
            timeline.push({
              status: 'Out for Delivery',
              time: timeString,
              details: `Driver is near destination: ${s.deliveryLocation}`
            });
          }
          
          return {
            ...s,
            progress: newProgress,
            currentCoords: { x, y },
            status: newStatus,
            distanceLeft,
            timeline,
            lastUpdate: `${now.getDate()} May 2026, ${timeString}`
          };
        }
        return s;
      });

      if (Math.random() < 0.08) {
        const activeShipments = shipments.filter(s => s.status === 'In Transit');
        if (activeShipments.length > 0) {
          const randomIndex = Math.floor(Math.random() * activeShipments.length);
          const targetShipment = activeShipments[randomIndex];
          const shipmentIndexInAll = shipments.findIndex(s => s.id === targetShipment.id);
          
          if (shipmentIndexInAll !== -1) {
            shipmentsUpdated = true;
            const updatedShipment = { ...shipments[shipmentIndexInAll] };
            
            if (Math.random() < 0.5) {
              updatedShipment.status = 'Delayed';
              updatedShipment.eta = updatedShipment.eta + ' (Delayed)';
              
              const now = new Date();
              const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              updatedShipment.timeline.push({
                status: 'Delayed',
                time: timeString,
                details: 'Traffic hold up or path blockage reported.'
              });
              
              const driverName = this.driversSubject.value.find(d => d.id === updatedShipment.driverId)?.name || 'Driver';
              this.addAlert(`Shipment ${updatedShipment.id} is delayed. Driver ${driverName} reported heavy traffic congestion.`, 'delay', updatedShipment.id);
            }
            
            shipments[shipmentIndexInAll] = updatedShipment;
          }
        }
      }
      
      if (shipmentsUpdated) {
        this.shipmentsSubject.next(shipments);
      }
    }, 4000);
  }
}
