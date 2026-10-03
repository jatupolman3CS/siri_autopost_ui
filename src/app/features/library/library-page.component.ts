import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';

@Component({
  selector: 'app-library-page',
  imports: [ModalComponent, InputFieldComponent, PermNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss',
})
export class LibraryPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly draft = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  protected readonly library = inject(LibraryStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly limits = INPUT_LIMITS;
  protected readonly t = this.i18n.t;

  protected readonly tab = signal<'media' | 'text'>('media');
  protected readonly modal = signal(false);
  protected readonly formTitle = signal('');
  protected readonly formText = signal('');
  protected readonly formErr = signal('');

  protected readonly uploading = signal(false);

  protected readonly mediaRows = computed(() => {
    const thumbs = this.library.thumbs();
    return this.library.media().map((m) => ({
      id: m.id,
      icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
      src: thumbs[m.id] ?? null,
      label: m.name,
      meta: m.meta,
      used: fmt(this.t().lib.usedN, { n: m.used }),
    }));
  });
  // Snippets carry no use count (the API does not track it), so their cards show none.
  protected readonly snippetRows = computed(() =>
    this.library.snippets().map((s) => ({ id: s.id, title: s.title, text: s.text })),
  );

  protected openSnippet(): void {
    if (!this.perm.canEdit()) return;
    this.formTitle.set('');
    this.formText.set('');
    this.formErr.set('');
    this.modal.set(true);
  }

  protected async saveSnippet(): Promise<void> {
    if (!this.perm.canEdit()) return;
    const title = this.formTitle().trim();
    const text = this.formText().trim();
    if (!title || !text) {
      this.formErr.set(this.t().lib.errTitle);
      return;
    }
    await this.library.addSnippet(title, text);
    this.modal.set(false);
    this.tab.set('text');
    this.notify.success(this.t().lib.added);
  }

  protected async upload(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length || !this.perm.canEdit()) return;
    this.uploading.set(true);
    this.tab.set('media');
    const a = this.t().api;
    if (files.length > 1) this.notify.info(fmt(a.uploading, { n: files.length }));
    try {
      const ok = await this.library.upload(files);
      if (ok) this.notify.success(fmt(a.uploaded, { n: ok }));
      if (ok < files.length) this.notify.error(a.uploadFailed);
    } finally {
      this.uploading.set(false);
    }
  }

  protected useMedia(id: string): void {
    if (!this.draft.addMedia(id)) {
      this.notify.error(fmt(this.t().api.mediaMax, { n: INPUT_LIMITS.postMedia }));
      return;
    }
    void this.router.navigateByUrl('/app/composer');
  }

  protected useSnippet(text: string): void {
    this.draft.appendText(text);
    void this.router.navigateByUrl('/app/composer');
  }
}
