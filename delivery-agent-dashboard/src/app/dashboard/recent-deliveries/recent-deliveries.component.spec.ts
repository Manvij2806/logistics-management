import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentDeliveriesComponent } from './recent-deliveries.component';
import { AppModule } from '../../app.module';

describe('RecentDeliveriesComponent', () => {
  let component: RecentDeliveriesComponent;
  let fixture: ComponentFixture<RecentDeliveriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RecentDeliveriesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});



