import { Component, AfterViewInit, ElementRef, OnDestroy, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { DeliveryService, Delivery } from '../../services/delivery.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-active-job',
  standalone: false,
  templateUrl: './active-job.component.html',
  styleUrl: './active-job.component.scss',
})
export class ActiveJobComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLElement>;

  private map: L.Map | undefined;
  private mapInitTimeout: ReturnType<typeof setTimeout> | undefined;
  private deliveriesSub: Subscription | undefined;

  hasActiveJob = false;
  activeJobRaw: Delivery | null = null;

  activeJob = {
    trackingNumber: '',
    orderId: '',
    pickup: {
      location: '',
      address: '',
      status: 'Pending',
      coords: [28.6273, 77.3725] as L.LatLngExpression,
    },
    dropoff: {
      location: '',
      address: '',
      status: 'Pending',
      coords: [27.2023, 78.0084] as L.LatLngExpression,
    },
    itemType: '',
    senderName: '',
    senderPhone: '',
    receiverName: '',
    receiverPhone: '',
    eta: '13:45',
    totalRoute: '0 km',
    totalDistance: '0 km',
    payment_status: 'Unpaid',
    googleMapsUrl: '',
    created_at: '',
    assigned_at: '',
    picked_up_at: '',
    in_transit_at: '',
    delivered_at: '',
  };

  timelineSteps: Array<{ label: string, time: string, completed: boolean }> = [];

  showOtpModal = false;
  otpPin = '';
  otpError = '';
  isVerifyingOtp = false;

  // AI Route Optimization variables
  isOptimizing = false;
  showOptimizationModal = false;
  optimizationData: any = null;
  originalRouteData: any = null;
  selectedReason = 'Heavy Traffic';
  optimizationNotes = '';
  optMessage = '';
  private routePolylines: L.Polyline[] = [];
  private lastDeliveryId: number | null = null;
  private lastDeliveryStatus: string | null = null;

  constructor(
    private deliveryService: DeliveryService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}


  ngOnInit(): void {
    this.deliveriesSub = this.deliveryService.deliveries$.subscribe((deliveries) => {
      // Active jobs are those that are accepted and not yet Delivered or Cancelled
      const active = deliveries.find(
        (d) => d.accepted === 'Accepted' && !['Delivered', 'Cancelled'].includes(d.status),
      );

      if (active) {
        const isNewOrUpdated = this.lastDeliveryId !== active.id || this.lastDeliveryStatus !== active.status;
        this.lastDeliveryId = active.id;
        this.lastDeliveryStatus = active.status;

        this.hasActiveJob = true;
        this.activeJobRaw = active;

        const pCoords = this.deliveryService.getCoords(active.pickup_address);
        const dCoords = this.deliveryService.getCoords(active.drop_address);
        const calculatedDist = this.deliveryService.calculateDistance(
          pCoords[0],
          pCoords[1],
          dCoords[0],
          dCoords[1],
        );

        const getCityName = (addr: string): string => {
          if (!addr) return 'N/A';
          const parts = addr.split(',').map(p => p.trim());
          if (parts.length >= 3) {
            const cityIndex = parts.length - 3;
            const areaIndex = parts.length - 4;
            if (areaIndex >= 0) {
              return `${parts[areaIndex]}, ${parts[cityIndex]}`;
            }
            return `${parts[parts.length - 3]}`;
          }
          return addr;
        };


        const formatTime = (dateStr: string | null | undefined): string => {
          if (!dateStr) return '-';
          try {
            const d = new Date(dateStr);
            return d.toLocaleString([], {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          } catch {
            return '-';
          }
        };

        const formatDateTime = (dateStr: string | null | undefined): string => {
          if (!dateStr) return '-';
          try {
            const d = new Date(dateStr);
            return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
          } catch {
            return '-';
          }
        };

        const getCityOnly = (addr: string): string => {
          const addrLower = (addr || '').toLowerCase();
          const cities = ["delhi", "noida", "gurugram", "faridabad", "ghaziabad", "agra", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "pune", "hyderabad", "jaipur", "lucknow", "gwalior"];
          const found = cities.find(c => addrLower.includes(c));
          if (found) {
            return found.charAt(0).toUpperCase() + found.slice(1);
          }
          return 'Hub';
        };

        // Check if intercity
        const pickupAddr = active.pickup_address.toLowerCase();
        const dropAddr = active.drop_address.toLowerCase();
        const cities = ["delhi", "noida", "gurugram", "faridabad", "ghaziabad", "agra", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "pune", "hyderabad", "jaipur", "lucknow", "gwalior"];
        const city1 = cities.find(c => pickupAddr.includes(c));
        const city2 = cities.find(c => dropAddr.includes(c));
        const isIntercity = city1 && city2 && city1 !== city2;
        
        const user = this.authService.currentUser();
        const agentCity = user?.city?.toLowerCase() || '';
        const isSourceLeg = agentCity && pickupAddr.includes(agentCity);

        const pickupCompleted = ['Picked Up', 'Arrived at Origin Hub', 'In Transit (Hub-to-Hub)', 'Arrived at Destination Hub', 'Delivered'].includes(active.status);
        const dropoffCompleted = active.status === 'Delivered';

        const totalDistanceVal = active.current_route_geometry 
          ? (isIntercity ? Math.round(calculatedDist * 1.1) : 11.4) 
          : (isIntercity ? Math.round(calculatedDist * 1.25) : 15.2);

        this.activeJob = {
          trackingNumber: active.tracking_number || '',
          orderId: active.delivery_id,
          pickup: {
            location: isIntercity && !isSourceLeg ? `${getCityOnly(active.drop_address)} Hub` : getCityName(active.pickup_address),
            address: isIntercity && !isSourceLeg ? `${getCityOnly(active.drop_address)} Hub` : active.pickup_address,
            status: pickupCompleted ? 'Completed' : 'Pending',
            coords: pCoords as L.LatLngExpression,
          },
          dropoff: {
            location: isIntercity && isSourceLeg ? `${getCityOnly(active.pickup_address)} Hub` : getCityName(active.drop_address),
            address: isIntercity && isSourceLeg ? `${getCityOnly(active.pickup_address)} Hub` : active.drop_address,
            status: dropoffCompleted ? 'Completed' : 'Pending',
            coords: dCoords as L.LatLngExpression,
          },
          itemType: active.package_description || 'General Cargo',
          senderName: active.sender_name || '—',
          senderPhone: active.sender_phone || '—',
          receiverName: active.recipient_name || active.customer_name || '—',
          receiverPhone: active.recipient_phone || active.customer_phone || '—',
          eta: active.estimated_delivery_at ? formatDateTime(active.estimated_delivery_at) : '18:00',
          totalRoute: `${totalDistanceVal} km`,
          totalDistance: `${totalDistanceVal} km`,
          googleMapsUrl: active.current_route_geometry
            ? `https://www.google.com/maps/dir/?api=1&origin=${pCoords[0]},${pCoords[1]}&destination=${dCoords[0]},${dCoords[1]}`
            : `https://www.google.com/maps/dir/?api=1&origin=${pCoords[0]},${pCoords[1]}&destination=${dCoords[0]},${dCoords[1]}&waypoints=${(pCoords[0] + dCoords[0]) / 2 + 0.012},${(pCoords[1] + dCoords[1]) / 2 - 0.012}`,
          payment_status: active.payment_status || 'Unpaid',
          created_at: formatTime(active.created_at),
          assigned_at: formatTime(active.assigned_at),
          picked_up_at: formatTime(active.picked_up_at),
          in_transit_at: formatTime(active.in_transit_at),
          delivered_at: formatTime(active.delivered_at),
        };

        if (isIntercity) {
          if (isSourceLeg) {
            // Leg 1: Pickup to Origin Hub
            this.timelineSteps = [
              { label: 'Created', time: formatTime(active.created_at), completed: true },
              { label: 'Assigned', time: formatTime(active.assigned_at), completed: !!active.assigned_at },
              { label: 'Picked Up', time: formatTime(active.picked_up_at), completed: ['Picked Up', 'Arrived at Origin Hub', 'In Transit (Hub-to-Hub)', 'Arrived at Destination Hub', 'Delivered'].includes(active.status) },
              { label: 'Arrived at Origin Hub', time: formatTime(active.arrived_origin_at), completed: ['Arrived at Origin Hub', 'In Transit (Hub-to-Hub)', 'Arrived at Destination Hub', 'Delivered'].includes(active.status) }
            ];
          } else {
            // Leg 2: Destination Hub to Delivery
            this.timelineSteps = [
              { label: 'Arrived at Hub', time: formatTime(active.arrived_destination_at || active.in_transit_at || active.created_at), completed: true },
              { label: 'Assigned', time: formatTime(active.assigned_at), completed: !!active.assigned_at },
              { label: 'Out for Delivery', time: formatTime(active.out_for_delivery_at), completed: ['Picked Up', 'Out for Delivery', 'Delivered'].includes(active.status) },
              { label: 'Delivered', time: formatTime(active.delivered_at), completed: active.status === 'Delivered' }
            ];
          }
        } else {
          // Same-city delivery
          this.timelineSteps = [
            { label: 'Created', time: formatTime(active.created_at), completed: true },
            { label: 'Assigned', time: formatTime(active.assigned_at), completed: !!active.assigned_at },
            { label: 'Picked Up', time: formatTime(active.picked_up_at), completed: ['Picked Up', 'In Transit', 'Delivered'].includes(active.status) },
            { label: 'In Transit', time: formatTime(active.in_transit_at), completed: ['In Transit', 'Delivered'].includes(active.status) },
            { label: 'Delivered', time: formatTime(active.delivered_at), completed: active.status === 'Delivered' }
          ];
        }

        if (isNewOrUpdated) {
          this.updateMap();
        }
      } else {
        this.hasActiveJob = false;
        this.activeJobRaw = null;
        if (this.map) {
          try {
            this.map.off();
            this.map.remove();
          } catch (_) {}
          this.map = undefined;
        }
      }
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    if (this.hasActiveJob) {
      this.updateMap();
      this.cdr.detectChanges();
    }
  }

  private updateMap(): void {
    if (this.mapInitTimeout) {
      clearTimeout(this.mapInitTimeout);
    }
    this.mapInitTimeout = setTimeout(() => {
      const container = this.mapContainer?.nativeElement;
      if (!container || !container.isConnected) {
        return;
      }
      if (this.map) {
        try {
          this.map.off();
          this.map.remove();
        } catch (_) {}
        this.map = undefined;
      }

      // Clear Leaflet's internal reference ID if it exists on the container element
      const anyContainer = container as any;
      if (anyContainer._leaflet_id) {
        anyContainer._leaflet_id = null;
      }

      try {
        this.initMap();
      } catch (err) {
        console.error('Leaflet map initialization failed:', err);
      }
    }, 200);
  }

  private async initMap(): Promise<void> {
    const pickupCoords = this.activeJob.pickup.coords as [number, number];
    const dropoffCoords = this.activeJob.dropoff.coords as [number, number];

    const container = this.mapContainer?.nativeElement;
    if (!container) return;

    // Check to avoid duplicate initialization on the same container
    if ((container as any)._leaflet_id) {
      return;
    }

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

      // Clear previous polylines
      this.routePolylines.forEach(p => p.remove());
      this.routePolylines = [];

      let routePoints: L.LatLngExpression[] = [];

      // Check if an optimized route was already applied and stored in delivery
      if (this.activeJobRaw && this.activeJobRaw.current_route_geometry) {
        try {
          const parsedGeom = JSON.parse(this.activeJobRaw.current_route_geometry);
          if (Array.isArray(parsedGeom) && parsedGeom.length > 0) {
            routePoints = parsedGeom;
          }
        } catch (e) {
          console.error('Failed to parse current_route_geometry:', e);
        }
      }

      // If no optimized geometry is stored, fetch unoptimized street route with detour
      if (routePoints.length === 0) {
        const detourLat = (pickupCoords[0] + dropoffCoords[0]) / 2 + 0.012;
        const detourLng = (pickupCoords[1] + dropoffCoords[1]) / 2 - 0.012;
        const detourCoords: [number, number] = [detourLat, detourLng];
        routePoints = await this.getOSRMRoute(pickupCoords, dropoffCoords, detourCoords);
      }

      // Render the path
      // If optimized route is applied, show it as solid green, else show it as regular blue
      const pathColor = (this.activeJobRaw && this.activeJobRaw.current_route_geometry) ? '#2ec4b6' : '#5b9aff';

      const initPoly = L.polyline(routePoints, {
        color: pathColor,
        weight: 5,
        opacity: 0.8,
      }).addTo(this.map);
      this.routePolylines.push(initPoly);

      const bounds = L.latLngBounds(routePoints);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    } catch (e) {
      console.error('Error inside initMap:', e);
      if (this.map) {
        try {
          this.map.remove();
        } catch (_) {}
        this.map = undefined;
      }
    }
  }

  canAdvanceStatus(): boolean {
    const d = this.activeJobRaw;
    if (!d) return false;
    
    // Check if intercity
    const pickupAddr = d.pickup_address.toLowerCase();
    const dropAddr = d.drop_address.toLowerCase();
    const cities = ["delhi", "noida", "gurugram", "faridabad", "ghaziabad", "agra", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "pune", "hyderabad", "jaipur", "lucknow", "gwalior"];
    const city1 = cities.find(c => pickupAddr.includes(c));
    const city2 = cities.find(c => dropAddr.includes(c));
    const isIntercity = city1 && city2 && city1 !== city2;
    
    const user = this.authService.currentUser();
    const agentCity = user?.city?.toLowerCase() || '';
    const isSourceLeg = agentCity && pickupAddr.includes(agentCity);
    
    if (isIntercity) {
      if (!isSourceLeg) {
        // Destination agent can only advance status if it has reached the destination hub (i.e. status is Arrived at Destination Hub, Picked Up, or Out for Delivery)
        // or if it is Assigned but has completed the transit leg (d.in_transit_at is set).
        if (d.status === 'Assigned') {
          return !!d.in_transit_at;
        }
        return ['Arrived at Destination Hub', 'Picked Up', 'Out for Delivery'].includes(d.status);
      }
    }
    return true;
  }

  getNextStepButtonLabel(): string {
    const d = this.activeJobRaw;
    if (!d) return 'CONFIRM ACTION';
    
    // Check if intercity
    const pickupAddr = d.pickup_address.toLowerCase();
    const dropAddr = d.drop_address.toLowerCase();
    const cities = ["delhi", "noida", "gurugram", "faridabad", "ghaziabad", "agra", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "pune", "hyderabad", "jaipur", "lucknow", "gwalior"];
    const city1 = cities.find(c => pickupAddr.includes(c));
    const city2 = cities.find(c => dropAddr.includes(c));
    const isIntercity = city1 && city2 && city1 !== city2;
    
    const user = this.authService.currentUser();
    const agentCity = user?.city?.toLowerCase() || '';
    const isSourceLeg = agentCity && pickupAddr.includes(agentCity);
    
    if (isIntercity) {
      if (isSourceLeg) {
        if (d.status === 'Assigned') return 'CONFIRM PICKUP';
        if (d.status === 'Picked Up') return 'ARRIVED AT HUB';
      } else {
        // Destination leg
        if (d.status === 'Assigned' || d.status === 'Arrived at Destination Hub') return 'START DELIVERY';
        if (d.status === 'Picked Up' || d.status === 'Out for Delivery') return 'CONFIRM DELIVERY';
      }
    } else {
      // Local same-city
      if (d.status === 'Assigned') return 'CONFIRM PICKUP';
      if (d.status === 'Picked Up') return 'START TRANSIT';
      if (d.status === 'In Transit') return 'CONFIRM DELIVERY';
    }
    return 'CONFIRM ACTION';
  }

  advanceStatus(): void {
    if (!this.activeJobRaw) return;
    
    const d = this.activeJobRaw;
    const currentStatus = d.status;
    
    const pickupAddr = d.pickup_address.toLowerCase();
    const dropAddr = d.drop_address.toLowerCase();
    const cities = ["delhi", "noida", "gurugram", "faridabad", "ghaziabad", "agra", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "pune", "hyderabad", "jaipur", "lucknow", "gwalior"];
    const city1 = cities.find(c => pickupAddr.includes(c));
    const city2 = cities.find(c => dropAddr.includes(c));
    const isIntercity = city1 && city2 && city1 !== city2;
    
    const user = this.authService.currentUser();
    const agentCity = user?.city?.toLowerCase() || '';
    const isSourceLeg = agentCity && pickupAddr.includes(agentCity);
    
    let nextStatus = '';
    let triggersOtp = false;
    
    if (isIntercity) {
      if (isSourceLeg) {
        if (currentStatus === 'Assigned') nextStatus = 'Picked Up';
        else if (currentStatus === 'Picked Up') nextStatus = 'Arrived at Origin Hub';
      } else {
        // Destination leg
        if (currentStatus === 'Assigned' || currentStatus === 'Arrived at Destination Hub') nextStatus = 'Picked Up';
        else if (currentStatus === 'Picked Up' || currentStatus === 'Out for Delivery') {
          triggersOtp = true;
          nextStatus = 'Delivered';
        }
      }
    } else {
      // Local same-city
      if (currentStatus === 'Assigned') nextStatus = 'Picked Up';
      else if (currentStatus === 'Picked Up') nextStatus = 'In Transit';
      else if (currentStatus === 'In Transit') {
        triggersOtp = true;
        nextStatus = 'Delivered';
      }
    }
    
    if (triggersOtp) {
      this.otpError = '';
      this.otpPin = '';
      this.deliveryService.requestOtp(d.id).subscribe({
        next: () => {
          this.showOtpModal = true;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error("Failed to request OTP", err);
        }
      });
      return;
    }
    
    if (nextStatus) {
      this.deliveryService
        .updateDelivery(d.id, {
          status: nextStatus as any,
        })
        .subscribe({
          next: () => {
            this.deliveryService.loadAgentDeliveries();
          },
        });
    }
  }

  submitOtp(): void {
    if (!this.activeJobRaw || !this.otpPin.trim()) return;
    this.isVerifyingOtp = true;
    this.otpError = '';
    this.deliveryService.verifyOtp(this.activeJobRaw.id, this.otpPin).subscribe({
      next: () => {
        this.isVerifyingOtp = false;
        this.showOtpModal = false;
        if (this.activeJobRaw) {
          this.activeJobRaw.status = 'Delivered';
        }
        this.hasActiveJob = false;
        this.deliveryService.loadAgentDeliveries();
        this.cdr.detectChanges();
      },

      error: (err) => {
        this.isVerifyingOtp = false;
        this.otpError = err.error?.detail || 'Invalid verification PIN. Access denied.';
        this.cdr.detectChanges();
      }
    });
  }


  cancelOtp(): void {
    this.showOtpModal = false;
    this.otpPin = '';
    this.otpError = '';
    this.cdr.detectChanges();
  }

  async getOSRMRoute(start: [number, number], end: [number, number], waypoint?: [number, number]): Promise<L.LatLngExpression[]> {
    try {
      let url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};`;
      if (waypoint) {
        url += `${waypoint[1]},${waypoint[0]};`;
      }
      url += `${end[1]},${end[0]}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates;
        return coords.map((c: any) => [c[1], c[0]] as L.LatLngExpression);
      }
    } catch (e) {
      console.error('OSRM route fetch failed, falling back to straight line:', e);
    }
    // Fallback: straight line
    return [start, end];
  }

  triggerRouteOptimization(): void {
    if (!this.activeJobRaw) return;
    this.isOptimizing = true;
    this.optMessage = '';
    this.deliveryService.optimizeRoute(this.activeJobRaw.id).subscribe({
      next: async (res) => {
        this.isOptimizing = false;
        this.optimizationData = res.optimized_route;
        this.showOptimizationModal = true;

        const pickupCoords = this.activeJob.pickup.coords as [number, number];
        const dropoffCoords = this.activeJob.dropoff.coords as [number, number];
        
        // Calculate a detour waypoint to represent an unoptimized route
        const detourLat = (pickupCoords[0] + dropoffCoords[0]) / 2 + 0.012;
        const detourLng = (pickupCoords[1] + dropoffCoords[1]) / 2 - 0.012;
        const detourCoords: [number, number] = [detourLat, detourLng];

        // Fetch precise actual street routes using OSRM
        const currentGeom = await this.getOSRMRoute(pickupCoords, dropoffCoords, detourCoords);
        const optimizedGeom = await this.getOSRMRoute(pickupCoords, dropoffCoords);

        this.previewOptimizedRoute(currentGeom, optimizedGeom);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isOptimizing = false;
        alert('Route optimization analysis failed. Please check backend connection.');
      }
    });
  }

  private previewOptimizedRoute(currentGeom: any[], optimizedGeom: any[]): void {
    if (!this.map) return;
    
    // Clear previous polylines
    this.routePolylines.forEach(p => p.remove());
    this.routePolylines = [];

    // Draw current path in red (dashed)
    const currentPoly = L.polyline(currentGeom, {
      color: '#ff4d4d',
      weight: 4,
      dashArray: '10, 10',
      opacity: 0.7
    }).addTo(this.map);
    this.routePolylines.push(currentPoly);

    // Draw optimized path in solid green
    const optPoly = L.polyline(optimizedGeom, {
      color: '#2ec4b6',
      weight: 5,
      opacity: 0.9
    }).addTo(this.map);
    this.routePolylines.push(optPoly);

    // Fit map bounds to show both routes
    const bounds = L.latLngBounds([...currentGeom, ...optimizedGeom]);
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  applyOptimizedRoute(): void {
    if (!this.activeJobRaw || !this.optimizationData) return;
    
    const payload = {
      route_id: this.optimizationData.route_id,
      reason: this.selectedReason,
      notes: this.optimizationNotes
    };

    this.deliveryService.applyRoute(this.activeJobRaw.id, payload).subscribe({
      next: (res) => {
        this.showOptimizationModal = false;
        this.optMessage = 'Optimized route applied successfully! Dispatcher has been notified.';
        
        // Reload deliveries to fetch the updated ETA
        this.deliveryService.loadAgentDeliveries();
        
        // Remove the red/current polyline, keep only the optimized solid green one
        if (this.routePolylines.length > 1) {
          this.routePolylines[0].remove(); // remove red dashed
          this.routePolylines[1].setStyle({ color: '#3f51b5' }); // set to active theme color
        }
        
        setTimeout(() => {
          this.optMessage = '';
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Failed to apply optimized route. Please try again.');
      }
    });
  }

  async cancelOptimization(): Promise<void> {
    this.showOptimizationModal = false;
    // Reset map route lines back to original default
    if (this.map && this.activeJobRaw) {
      this.routePolylines.forEach(p => p.remove());
      this.routePolylines = [];
      
      const pickupCoords = this.activeJob.pickup.coords as [number, number];
      const dropoffCoords = this.activeJob.dropoff.coords as [number, number];
      
      const detourLat = (pickupCoords[0] + dropoffCoords[0]) / 2 + 0.012;
      const detourLng = (pickupCoords[1] + dropoffCoords[1]) / 2 - 0.012;
      const detourCoords: [number, number] = [detourLat, detourLng];

      const routePoints = await this.getOSRMRoute(pickupCoords, dropoffCoords, detourCoords);

      const defaultPoly = L.polyline(routePoints, {
        color: '#5b9aff',
        weight: 5,
        opacity: 0.8,
      }).addTo(this.map);
      this.routePolylines.push(defaultPoly);
      
      const bounds = L.latLngBounds(routePoints);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }


  ngOnDestroy(): void {
    if (this.mapInitTimeout) {
      clearTimeout(this.mapInitTimeout);
    }
    if (this.deliveriesSub) {
      this.deliveriesSub.unsubscribe();
    }
    if (this.map) {
      this.map.remove();
    }
  }
}
