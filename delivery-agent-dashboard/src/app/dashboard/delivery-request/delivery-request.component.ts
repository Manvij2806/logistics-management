import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DeliveryService } from '../../services/delivery.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-delivery-request',
  standalone: false,
  templateUrl: './delivery-request.component.html',
  styleUrl: './delivery-request.component.scss',
})
export class DeliveryRequestComponent implements OnInit, OnDestroy {
  visible = false;
  private visibilitySub: Subscription | undefined;
  private deliverySub: Subscription | undefined;
  deliveryIdNum: number | null = null;

  request = {
    deliveryId: '',
    pickup: '',
    dropoff: '',
    totalDistance: '',
    earn: '',
  };

  constructor(
    private deliveryService: DeliveryService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}


  ngOnInit(): void {
    this.visibilitySub = this.deliveryService.requestVisible$.subscribe((visible) => {
      this.visible = visible;
      this.cdr.detectChanges();
    });

    this.deliverySub = this.deliveryService.pendingDelivery$.subscribe((d) => {
      if (d) {
        const pCoords = this.deliveryService.getCoords(d.pickup_address);
        const dCoords = this.deliveryService.getCoords(d.drop_address);
        const dist = this.deliveryService.calculateDistance(
          pCoords[0],
          pCoords[1],
          dCoords[0],
          dCoords[1],
        );
        const earnVal = this.deliveryService.getEarnings(dist);

        this.deliveryIdNum = d.id;
        this.request = {
          deliveryId: d.delivery_id,
          pickup: d.pickup_address,
          dropoff: d.drop_address,
          totalDistance: `${dist} km`,
          earn: `Rs. ${earnVal.toLocaleString('en-IN')}`,
        };
      } else {
        this.deliveryIdNum = null;
      }
      this.cdr.detectChanges();
    });
  }

  accept(): void {
    if (this.deliveryIdNum) {
      const currentUser = this.authService.currentUser();
      this.deliveryService
        .updateDelivery(this.deliveryIdNum, {
          accepted: 'Accepted',
          status: 'Assigned',
          agent: currentUser?.full_name || null,
          agent_id: currentUser?.id ? Number(currentUser.id) : null
        } as any)
        .subscribe({
          next: () => {
            this.deliveryService.loadAgentDeliveries();
          },
        });
    }
  }


  reject(): void {
    if (this.deliveryIdNum) {
      this.deliveryService
        .updateDelivery(this.deliveryIdNum, {
          accepted: 'Rejected',
        } as any)
        .subscribe({
          next: () => {
            this.deliveryService.loadAgentDeliveries();
          },
        });
    }
  }

  ngOnDestroy(): void {
    if (this.visibilitySub) {
      this.visibilitySub.unsubscribe();
    }
    if (this.deliverySub) {
      this.deliverySub.unsubscribe();
    }
  }
}
