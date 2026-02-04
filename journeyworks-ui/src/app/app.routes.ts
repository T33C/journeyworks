/**
 * JourneyWorks UI - Routes Configuration
 */

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/analysis/analysis-dashboard.component').then(
        (m) => m.AnalysisDashboardComponent,
      ),
    title: 'Analysis Dashboard - JourneyWorks',
  },
  {
    path: 'communications',
    loadComponent: () =>
      import('./features/communications/communications.component').then(
        (m) => m.CommunicationsComponent,
      ),
    title: 'Communications - JourneyWorks',
  },
  {
    path: 'communications/:id',
    loadComponent: () =>
      import('./features/communication-detail/communication-detail.component').then(
        (m) => m.CommunicationDetailComponent,
      ),
    title: 'Communication Detail - JourneyWorks',
  },
  {
    path: 'research',
    loadComponent: () =>
      import('./features/research/research.component').then(
        (m) => m.ResearchComponent,
      ),
    title: 'Research - JourneyWorks',
  },
  {
    path: 'customers/:id',
    loadComponent: () =>
      import('./features/customer-detail/customer-detail.component').then(
        (m) => m.CustomerDetailComponent,
      ),
    title: 'Customer Detail - JourneyWorks',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
