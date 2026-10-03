import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-library-page',
  imports: [ModalComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ t().lib.title }}</h1>
          <p>{{ t().lib.sub }}</p>
        </div>
        <div class="actions">
          <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="openSnippet()">
            <i class="ph ph-text-t"></i>{{ t().lib.newSnippet }}
          </button>
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-primary"
            [disabled]="uploading()"
            (click)="picker.click()"
          >
            <i class="ph ph-upload-simple"></i>{{ t().lib.upload }}
          </button>
          <input
            #picker
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            (change)="upload(picker)"
          />
        </div>
      </div>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          [class.on]="tab() === 'media'"
          [attr.aria-selected]="tab() === 'media'"
          (click)="tab.set('media')"
        >
          {{ t().lib.tabMedia }} ({{ library.media().length }})
        </button>
        <button
          type="button"
          role="tab"
          [class.on]="tab() === 'text'"
          [attr.aria-selected]="tab() === 'text'"
          (click)="tab.set('text')"
        >
          {{ t().lib.tabText }} ({{ library.snippets().length }})
        </button>
      </div>

      @if (tab() === 'media') {
        <div class="grid g180">
          @for (m of mediaRows(); track m.id) {
            <div class="panel panel-hover card">
              <div class="thumb">
                @if (m.src) {
                  <img [src]="m.src" alt="" />
                } @else {
                  <i class="ph" [class]="m.icon"></i>
                }
              </div>
              <div class="fw5 fs14 ellipsis">{{ m.label }}</div>
              <div class="small muted">{{ m.meta }}</div>
              <div class="small muted">{{ m.used }}</div>
              <button
                type="button"
                class="su-btn su-btn-sm su-btn-ghost su-btn-full"
                (click)="useMedia(m.id)"
              >
                {{ t().lib.use }}
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="grid g280">
          @for (s of snippetRows(); track s.id) {
            <div class="panel panel-hover card snip">
              <div class="fs14 fw6">{{ s.title }}</div>
              <p class="fs14 muted grow-p">{{ s.text }}</p>
              <div class="foot">
                <span class="small muted">{{ s.used }}</span>
                <button
                  type="button"
                  class="su-btn su-btn-sm su-btn-ghost"
                  (click)="useSnippet(s.text)"
                >
                  {{ t().lib.use }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-modal [open]="modal()" [title]="t().lib.newSnippet" (closed)="modal.set(false)">
      <div class="form">
        <app-input-field [label]="t().lib.snippetTitle" [(value)]="formTitle" />
        <app-input-field [label]="t().lib.snippetText" [(value)]="formText" [error]="formErr()" />
      </div>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="modal.set(false)">
          {{ t().common.cancel }}
        </button>
        <button type="button" class="su-btn su-btn-sm su-btn-primary" (click)="saveSnippet()">
          {{ t().common.save }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .fs14 {
      font-size: 14px;
    }
    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--color-border);
      button {
        height: 44px;
        padding: 0 16px;
        border: none;
        background: none;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        color: var(--color-text-muted);
        &.on {
          color: var(--color-primary);
          box-shadow: inset 0 -2px 0 var(--color-primary);
        }
      }
    }
    .grid {
      display: grid;
      gap: 16px;
    }
    .g180 {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
    .g280 {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    .card {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      &.snip {
        padding: 16px;
      }
    }
    .thumb {
      aspect-ratio: 1;
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      font-size: 32px;
      overflow: hidden;
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    .grow-p {
      margin: 0;
      flex: 1;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class LibraryPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly draft = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  protected readonly library = inject(LibraryStore);
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
  protected readonly snippetRows = computed(() =>
    this.library.snippets().map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
      used: fmt(this.t().lib.usedN, { n: s.used }),
    })),
  );

  protected openSnippet(): void {
    this.formTitle.set('');
    this.formText.set('');
    this.formErr.set('');
    this.modal.set(true);
  }

  protected async saveSnippet(): Promise<void> {
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
    if (!files.length) return;
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
    this.draft.addMedia(id);
    void this.router.navigateByUrl('/app/composer');
  }

  protected useSnippet(text: string): void {
    this.draft.appendText(text);
    void this.router.navigateByUrl('/app/composer');
  }
}
