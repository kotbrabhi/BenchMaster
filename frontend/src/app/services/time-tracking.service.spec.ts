import { computed } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { TimeTrackingService } from './time-tracking.service';

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TimeTrackingService] });
    service = TestBed.inject(TimeTrackingService);
  });

  afterEach(() => service.stop());

  it('updates the live clock while active and stops ticking when stopped', fakeAsync(() => {
    const game = {
      clockElapsedSeconds: 0,
      isClockRunning: true,
      lastClockStartedAt: new Date().toISOString()
    };

    service.start();
    const clockSeconds = computed(() => service.getClockSeconds(game));
    expect(clockSeconds()).toBe(0);

    tick(1000);
    expect(clockSeconds()).toBe(1);

    service.stop();
    const stoppedAt = clockSeconds();
    tick(3000);

    expect(clockSeconds()).toBe(stoppedAt);
  }));
});
