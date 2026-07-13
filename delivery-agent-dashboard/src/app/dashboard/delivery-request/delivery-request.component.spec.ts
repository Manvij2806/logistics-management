import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryRequestComponent } from './delivery-request.component';
import { AppModule } from '../../app.module';

describe('DeliveryRequestComponent', () => {
  let component: DeliveryRequestComponent;
  let fixture: ComponentFixture<DeliveryRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DeliveryRequestComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});



