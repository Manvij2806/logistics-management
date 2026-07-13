import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { UserList } from './user-list';
import { UserService } from '../../services/user';

describe('UserList', () => {
  let component: UserList;
  let fixture: ComponentFixture<UserList>;

  const mockUserService = {
    getUsers: () => of({ total: 0, page: 1, page_size: 10, users: [] }),
    deleteUser: () => of(void 0),
    updateUserStatus: () => of({}),
    updateUser: () => of({}),
    resetPassword: () => of({ message: 'ok' }),
    createUser: () => of({})
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserList],
      providers: [{ provide: UserService, useValue: mockUserService }]
    }).compileComponents();

    fixture = TestBed.createComponent(UserList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
