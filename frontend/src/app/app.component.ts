import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from './shared/pipes/translate.pipe';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly router = inject(Router);
  isSidebarCollapsed = false;

  readonly navigationItems = [
    { labelKey: 'app.nav.home' as const, link: '/', icon: 'home' as const },
    { labelKey: 'app.nav.newGame' as const, link: '/games/new', icon: 'plus' as const }
  ];

  get isLiveMatchRoute(): boolean {
    return this.router.url.includes('/live');
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
}
