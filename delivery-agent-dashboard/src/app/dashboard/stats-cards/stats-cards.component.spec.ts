import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatsCardsComponent } from './stats-cards.component';
import { AppModule } from '../../app.module';

describe('StatsCardsComponent', () => {
  let component: StatsCardsComponent;
  let fixture: ComponentFixture<StatsCardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsCardsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});



