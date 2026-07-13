import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { dispatcherGuard } from './guards/dispatcher.guard';
import { Layout } from './components/layout/layout';
import { Login } from './components/login/login';
import { AuthBridge } from './components/auth-bridge/auth-bridge';

// New page imports
import { Dashboard } from './pages/dashboard/dashboard';
import { Deliveries } from './pages/deliveries/deliveries';
import { CreateDelivery } from './pages/deliveries/create-delivery/create-delivery';
import { DeliveryDetails } from './pages/deliveries/delivery-details/delivery-details';
import { SelectAgent } from './pages/deliveries/select-agent/select-agent';
import { AgentWorkload } from './pages/deliveries/agent-workload/agent-workload';
import { PlaceholderPage } from './pages/placeholder/placeholder';
import { ProfileComponent } from './pages/profile/profile';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [loginGuard] },
  { path: 'auth-bridge', component: AuthBridge },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard, dispatcherGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'deliveries', component: Deliveries },
      { path: 'deliveries/create', component: CreateDelivery },
      { path: 'deliveries/:id/details', component: DeliveryDetails },
      { path: 'deliveries/:id/select-agent', component: SelectAgent },
      { path: 'agent-workload', component: AgentWorkload },
      { path: 'profile', component: ProfileComponent },
      { path: 'route-optimization', component: PlaceholderPage, data: { title: 'Route Optimization' } },
      { path: 'customers', component: PlaceholderPage, data: { title: 'Customers' } },
      { path: 'agents', component: PlaceholderPage, data: { title: 'Agents' } },
      { path: 'reports', component: PlaceholderPage, data: { title: 'Reports' } },
      { path: 'settings', component: PlaceholderPage, data: { title: 'Settings' } },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
