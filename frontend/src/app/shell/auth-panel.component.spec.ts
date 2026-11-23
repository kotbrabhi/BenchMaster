import { TestBed } from '@angular/core/testing';
import { AuthPanelComponent } from './auth-panel.component';

describe('AuthPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AuthPanelComponent] }).compileComponents();
  });

  it('renders an accessible modal dialog', () => {
    const fixture = TestBed.createComponent(AuthPanelComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"][aria-modal="true"]')).toBeTruthy();
  });

  it('emits the selected login credentials', () => {
    const fixture = TestBed.createComponent(AuthPanelComponent);
    const component = fixture.componentInstance;
    const submitted = jasmine.createSpy('submitted');
    component.submitted.subscribe(submitted);
    fixture.detectChanges();
    component.authEmail = 'coach@example.com';
    component.authPassword = 'secret123';
    component.submit();
    expect(submitted).toHaveBeenCalledWith({ intent: 'login', name: '', email: 'coach@example.com', password: 'secret123' });
  });

  it('requires a name for registration and validates the email and password', () => {
    const fixture = TestBed.createComponent(AuthPanelComponent);
    const component = fixture.componentInstance;
    component.setAuthIntent('register');
    component.authEmail = 'coach@example.com';
    component.authPassword = 'secret123';
    expect(component.canSubmitAuth()).toBeFalse();
    component.authName = 'Coach';
    expect(component.canSubmitAuth()).toBeTrue();
  });
});
