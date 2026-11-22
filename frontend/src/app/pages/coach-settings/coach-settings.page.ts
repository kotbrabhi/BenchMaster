import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CoachSettings, DEFAULT_COACH_SETTINGS, LiveStatKey } from '../../core/coach-settings';
import { getErrorMessage } from '../../core/api';
import { I18nService } from '../../core/i18n.service';
import { CoachSettingsService } from '../../services/coach-settings.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationKey } from '../../core/translations';

@Component({
  selector: 'app-coach-settings-page', standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ConfirmationDialogComponent],
  templateUrl: './coach-settings.page.html', styleUrl: './coach-settings.page.scss'
})
export class CoachSettingsPageComponent implements OnInit {
  private readonly service = inject(CoachSettingsService);
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t;
  readonly defaults = DEFAULT_COACH_SETTINGS;
  readonly settings = signal<CoachSettings>({ ...DEFAULT_COACH_SETTINGS, visibleLiveStats: [...DEFAULT_COACH_SETTINGS.visibleLiveStats] });
  readonly initialSettings = signal<CoachSettings | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isFirstVisit = signal(false);
  readonly loadedDefaults = signal(false);
  readonly error = signal('');
  readonly status = signal<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  readonly resetDialog = signal(false);
  readonly dirty = computed(() => JSON.stringify(this.settings()) !== JSON.stringify(this.initialSettings()));
  readonly stateLabel = computed(() => this.isLoading() ? 'coachSettings.loading' : this.status() === 'saving' ? 'coachSettings.saving' : this.status() === 'error' ? 'coachSettings.error' : this.dirty() ? (this.loadedDefaults() ? 'coachSettings.defaultsDirty' : 'coachSettings.unsaved') : this.isFirstVisit() ? 'coachSettings.defaults' : 'coachSettings.saved');
  readonly statOptions: LiveStatKey[] = ['points', 'rebounds', 'assists', 'blocks', 'interceptions', 'fouls'];
  readonly statLabel = (key: LiveStatKey): TranslationKey => `coachSettings.stats.${key}` as TranslationKey;
  async ngOnInit() {
    try {
      const stored = await this.service.load();
      this.service.settings.set(stored);
      this.settings.set({ ...stored, visibleLiveStats: [...stored.visibleLiveStats] });
      this.isFirstVisit.set(JSON.stringify(stored) === JSON.stringify(DEFAULT_COACH_SETTINGS));
      this.loadedDefaults.set(JSON.stringify(stored) === JSON.stringify(DEFAULT_COACH_SETTINGS));
      this.initialSettings.set({ ...stored, visibleLiveStats: [...stored.visibleLiveStats] });
    } catch (error) { this.error.set(getErrorMessage(error, this.t)); this.status.set('error'); }
    finally { this.isLoading.set(false); }
  }
  update<K extends keyof CoachSettings>(key: K, value: CoachSettings[K]) {
    this.settings.update((settings) => ({ ...settings, [key]: value })); this.status.set('dirty'); this.error.set('');
  }
  toggleStat(stat: LiveStatKey, checked: boolean) {
    const current = this.settings().visibleLiveStats;
    const next = checked ? [...current, stat] : current.filter((item) => item !== stat);
    if (!next.length) return;
    this.update('visibleLiveStats', this.statOptions.filter((item) => next.includes(item)));
  }
  async save() {
    if (!this.dirty() || this.isSaving()) return;
    this.isSaving.set(true); this.status.set('saving'); this.error.set('');
    try {
      const saved = await this.service.save(this.settings());
      this.settings.set({ ...saved, visibleLiveStats: [...saved.visibleLiveStats] });
      this.initialSettings.set({ ...saved, visibleLiveStats: [...saved.visibleLiveStats] }); this.status.set('saved'); this.isFirstVisit.set(false);
    } catch (error) { this.error.set(getErrorMessage(error, this.t)); this.status.set('error'); }
    finally { this.isSaving.set(false); }
  }
  requestReset() { this.resetDialog.set(true); }
  async confirmReset() {
    this.resetDialog.set(false);
    this.settings.set({ ...DEFAULT_COACH_SETTINGS, visibleLiveStats: [...DEFAULT_COACH_SETTINGS.visibleLiveStats] });
    this.status.set('dirty'); this.error.set(''); await this.save();
  }
  isStatSelected(stat: LiveStatKey) { return this.settings().visibleLiveStats.includes(stat); }
}
