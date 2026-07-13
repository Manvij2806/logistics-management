import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { ResetPasswordModal } from './reset-password-modal';

describe('ResetPasswordModal', () => {
  let component: ResetPasswordModal;
  let fixture: ComponentFixture<ResetPasswordModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordModal],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordModal);
    component = fixture.componentInstance;
    component.user = {
      id: '1',
      full_name: 'John Doe',
      username: 'john_d',
      email: 'john@example.com',
      role: 'Admin',
      status: 'Active'
    };
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
