/**
 * JourneyWorks UI - Root Component
 */

import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'JourneyWorks';
  sidenavCollapsed = signal(true);

  navItems = [
    { path: '/', icon: 'analytics', label: 'Analysis', exact: true },
    {
      path: '/communications',
      icon: 'email',
      label: 'Communications',
      exact: false,
    },
    { path: '/research', icon: 'psychology', label: 'Research', exact: false },
  ];

  toggleSidenav() {
    this.sidenavCollapsed.update((v) => !v);
  }
}
