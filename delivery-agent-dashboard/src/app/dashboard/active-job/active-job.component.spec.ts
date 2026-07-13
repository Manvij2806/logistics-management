import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveJobComponent } from './active-job.component';
import { AppModule } from '../../app.module';

describe('ActiveJobComponent', () => {
  let component: ActiveJobComponent;
  let fixture: ComponentFixture<ActiveJobComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveJobComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});



