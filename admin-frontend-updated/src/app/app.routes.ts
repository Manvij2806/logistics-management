import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { loginGuard } from './guards/login.guard';
import { roleGuard } from './guards/role.guard';
import { Layout } from './components/layout/layout';
import { Login } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { Deliveries } from './components/deliveries/deliveries';
import { UserList } from './components/user-list/user-list';
import { AuditLogs } from './components/audit-logs/audit-logs';
import { Agents } from './components/agents/agents';
import { Customers } from './components/customers/customers';
import { ProfileComponent } from './components/profile/profile';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [loginGuard] },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'deliveries', component: Deliveries, canActivate: [roleGuard(['Admin', 'Dispatcher'])] },
      { path: 'agents', component: Agents, canActivate: [adminGuard] },
      { path: 'customers', component: Customers, canActivate: [adminGuard] },
      { path: 'users', component: UserList, canActivate: [adminGuard] },
      { path: 'audit-logs', component: AuditLogs, canActivate: [adminGuard] },
      { path: 'profile', component: ProfileComponent }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
