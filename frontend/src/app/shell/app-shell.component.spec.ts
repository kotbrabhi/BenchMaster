import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('keeps the existing primary navigation destinations', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('nav.tabbar a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/games/new', '/training/new', '/friendlies']);
  });

  it('emits theme and login requests from the shell controls', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const component = fixture.componentInstance;
    const themeSpy = spyOn(component.themeToggleRequested, 'emit');
    const loginSpy = spyOn(component.loginRequested, 'emit');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.shell__theme-toggle').click();
    fixture.nativeElement.querySelector('.shell__account-toggle').click();

    expect(themeSpy).toHaveBeenCalled();
    expect(loginSpy).toHaveBeenCalled();
  });
});
