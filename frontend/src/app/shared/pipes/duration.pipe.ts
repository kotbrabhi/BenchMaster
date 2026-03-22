import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationPipe implements PipeTransform {
  transform(totalSeconds: number, style: 'clock' | 'compact' = 'clock') {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (style === 'compact') {
      if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
      }

      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

