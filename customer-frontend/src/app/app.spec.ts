import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should default to dashboard view', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.activeView).toBe('dashboard');
  });

  it('should change activeView when onViewChange is called', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.onViewChange('shipments');
    expect(app.activeView).toBe('shipments');
  });
});
