import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { EditUserModal } from './edit-user-modal';

describe('EditUserModal', () => {
  let component: EditUserModal;
  let fixture: ComponentFixture<EditUserModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditUserModal],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(EditUserModal);
    component = fixture.componentInstance;
    component.user = {
      id: '1',
      full_name: 'John Doe',
      username: 'john_d',
      email: 'john@example.com',
      phone_number: '+1 555-123-4567',
      role: 'Admin',
      status: 'Active'
    };
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
