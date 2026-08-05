import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogisticsAi } from './logistics-ai';

describe('LogisticsAi', () => {
  let component: LogisticsAi;
  let fixture: ComponentFixture<LogisticsAi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogisticsAi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogisticsAi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
