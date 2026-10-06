import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { POSTS_PATH, newPostParams } from '../posts/posts-link';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { RenameModalComponent } from '../../shared/components/rename-modal/rename-modal.component';

@Component({
  selector: 'app-library-page',
  imports: [
    ModalComponent,
    InputFieldComponent,
    PermNoteComponent,
    PagerComponent,
    CheckboxComponent,
    ConfirmModalComponent,
    RenameModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss',
})
export class LibraryPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly draft = inject(DraftStore);
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

  /** The snippet being edited in the snippet dialog (null = a new one). */
  private readonly editingSnippet = signal<string | null>(null);
  protected readonly snippetModalTitle = computed(() =>
    this.editingSnippet() ? this.t().api.snippetEdit : this.t().lib.newSnippet,
  );
  /** The file being renamed, the files being deleted and the snippet being deleted (null = no dialog). */
  protected readonly renaming = signal<{ id: string; name: string } | null>(null);
  protected readonly deletingMedia = signal<{ ids: string[]; name: string } | null>(null);
  protected readonly deletingSnippet = signal<{ id: string; title: string } | null>(null);
  protected readonly mediaDeleteBody = computed(() => {
    const d = this.deletingMedia();
    if (!d) return '';
    const a = this.t().api;
    return d.ids.length > 1
      ? fmt(a.mediaDeleteManyBody, { n: d.ids.length })
      : fmt(a.mediaDeleteBody, { name: d.name });
  });
  protected readonly snippetDeleteBody = computed(() =>
    fmt(this.t().api.snippetDeleteBody, { name: this.deletingSnippet()?.title ?? '' }),
  );

  /** The post in progress in numbers, for the bar that leads back to it. */
  protected readonly draftBar = computed(() => {
    const d = this.draft.draft();
    return fmt(this.t().lib.draftBar, { n: d.media.length, c: d.text.length });
  });

  /** Which files the grid shows: every one, the ones in no folder, or one folder. */
  protected readonly folder = signal<'all' | 'none' | string>('all');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly folderModal = signal<'new' | 'rename' | null>(null);
  protected readonly folderName = signal('');
  protected readonly folderErr = signal('');
  protected readonly deleteModal = signal(false);
  protected readonly savingFolder = signal(false);

  protected readonly currentFolder = computed(
    () => this.library.folders().find((f) => f.id === this.folder()) ?? null,
  );
  /** Counts for the folder chips. */
  protected readonly folderChips = computed(() => {
    const media = this.library.media();
    const count = new Map<string, number>();
    let none = 0;
    for (const m of media) {
      if (m.folderId) count.set(m.folderId, (count.get(m.folderId) ?? 0) + 1);
      else none++;
    }
    return {
      all: media.length,
      none,
      folders: this.library
        .folders()
        .map((f) => ({ id: f.id, name: f.name, n: count.get(f.id) ?? 0 })),
    };
  });
  private readonly shownMedia = computed(() => {
    const f = this.folder();
    const media = this.library.media();
    if (f === 'all') return media;
    return media.filter((m) => (f === 'none' ? !m.folderId : m.folderId === f));
  });
  protected readonly moveOptions = computed(() => this.library.folders());

  protected readonly mediaPager = new Pager(20);
  protected readonly snippetPager = new Pager(20);

  /** The media on the page shown (the library can hold thousands, so only these are rendered and fetched). */
  private readonly mediaPage = computed(() => this.mediaPager.slice(this.shownMedia()));

  protected readonly mediaRows = computed(() => {
    const thumbs = this.library.thumbs();
    const videos = this.library.videos();
    const loading = this.library.videoLoading();
    return this.mediaPage().map((m) => ({
      id: m.id,
      selected: this.selected().has(m.id),
      folderId: m.folderId ?? '',
      video: m.kind === 'video',
      videoSrc: videos[m.id] ?? null,
      videoLoading: !!loading[m.id],
      active: m.active !== false,
      icon: m.kind === 'video' ? 'ph-video' : 'ph-image',
      src: thumbs[m.id] ?? null,
      label: m.name,
      meta: m.meta,
      used: fmt(this.t().lib.usedN, { n: m.used }),
    }));
  });
  // Snippets carry no use count (the API does not track it), so their cards show none.
  protected readonly snippetRows = computed(() =>
    this.snippetPager
      .slice(this.library.snippets())
      .map((s) => ({ id: s.id, title: s.title, text: s.text, active: s.active !== false })),
  );

  constructor() {
    // Thumbnails are fetched for the visible page only.
    effect(() => this.library.ensureThumbs(this.mediaPage().map((m) => m.id)));
  }

  protected pickFolder(f: 'all' | 'none' | string): void {
    this.folder.set(f);
    this.selected.set(new Set());
    this.mediaPager.go(1);
  }

  protected toggleSelect(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Selects every file on the page shown, or clears the selection when they are all selected already. */
  protected selectPage(): void {
    const ids = this.mediaPage().map((m) => m.id);
    const all = ids.every((id) => this.selected().has(id));
    this.selected.update((s) => {
      const next = new Set(s);
      for (const id of ids) all ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected openFolder(mode: 'new' | 'rename'): void {
    if (!this.perm.canEdit()) return;
    this.folderName.set(mode === 'rename' ? (this.currentFolder()?.name ?? '') : '');
    this.folderErr.set('');
    this.folderModal.set(mode);
  }

  protected async saveFolder(): Promise<void> {
    const name = this.folderName().trim();
    if (!name) {
      this.folderErr.set(this.t().lib.fErrName);
      return;
    }
    this.savingFolder.set(true);
    try {
      if (this.folderModal() === 'rename' && this.currentFolder()) {
        await this.library.renameFolder(this.currentFolder()!.id, name);
      } else {
        const f = await this.library.createFolder(name);
        if (f) this.pickFolder(f.id);
      }
      this.folderModal.set(null);
    } catch {
      // The server refuses a repeated name (422): say so next to the field.
      this.folderErr.set(this.t().lib.fErrSave);
    } finally {
      this.savingFolder.set(false);
    }
  }

  protected async removeFolder(): Promise<void> {
    const f = this.currentFolder();
    if (!f) return;
    await this.library.deleteFolder(f.id);
    this.deleteModal.set(false);
    this.pickFolder('all');
    this.notify.success(this.t().lib.fDeleted);
  }

  /** Moves the selected files, or one file from its card, to a folder ('' = out of every folder). */
  protected async moveTo(ids: readonly string[], target: string): Promise<void> {
    if (!this.perm.canEdit() || !ids.length) return;
    await this.library.moveMedia(ids, target || null);
    this.selected.update((s) => new Set([...s].filter((id) => !ids.includes(id))));
    this.notify.success(fmt(this.t().lib.fMoved, { n: ids.length }));
  }

  protected moveOne(id: string, el: HTMLSelectElement): void {
    void this.moveTo([id], el.value);
  }

  protected moveSelected(el: HTMLSelectElement): void {
    const target = el.value;
    el.value = '__';
    if (target === '__') return;
    void this.moveTo([...this.selected()], target);
  }

  protected playVideo(id: string): void {
    void this.library.loadVideo(id);
  }

  protected openSnippet(): void {
    if (!this.perm.canEdit()) return;
    this.editingSnippet.set(null);
    this.formTitle.set('');
    this.formText.set('');
    this.formErr.set('');
    this.modal.set(true);
  }

  protected editSnippet(s: { id: string; title: string; text: string }): void {
    if (!this.perm.canEdit()) return;
    this.editingSnippet.set(s.id);
    this.formTitle.set(s.title);
    this.formText.set(s.text);
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
    const editing = this.editingSnippet();
    try {
      if (editing) await this.library.updateSnippet(editing, title, text);
      else await this.library.addSnippet(title, text);
    } catch {
      this.formErr.set(this.t().api.itemSaveFailed);
      return;
    }
    this.modal.set(false);
    this.tab.set('text');
    this.notify.success(editing ? this.t().api.itemRenamed : this.t().lib.added);
  }

  protected async toggleSnippet(id: string, active: boolean): Promise<void> {
    if (!this.perm.canEdit()) return;
    try {
      await this.library.setSnippetActive(id, active);
      this.notify.success(active ? this.t().api.itemSwitchedOn : this.t().api.itemSwitchedOff);
    } catch {
      // The interceptor tells the user; the switch stays where the server has it.
    }
  }

  protected readonly removeSnippet = async (): Promise<void> => {
    const s = this.deletingSnippet();
    if (!s) return;
    await this.library.deleteSnippet(s.id);
    this.notify.success(this.t().api.itemDeleted);
  };

  protected readonly saveMediaName = async (name: string): Promise<void> => {
    const r = this.renaming();
    if (!r) return;
    await this.library.renameMedia(r.id, name);
    this.notify.success(this.t().api.itemRenamed);
  };

  protected readonly removeMedia = async (): Promise<void> => {
    const d = this.deletingMedia();
    if (!d) return;
    await this.library.deleteMedia(d.ids);
    this.selected.update((s) => new Set([...s].filter((id) => !d.ids.includes(id))));
    this.notify.success(fmt(this.t().api.mediaDeletedN, { n: d.ids.length }));
  };

  protected selectedIds(): string[] {
    return [...this.selected()];
  }

  protected askDeleteSelected(): void {
    const ids = [...this.selected()];
    if (!ids.length || !this.perm.canEdit()) return;
    this.deletingMedia.set({ ids, name: '' });
  }

  protected async toggleMedia(ids: readonly string[], active: boolean): Promise<void> {
    if (!this.perm.canEdit() || !ids.length) return;
    try {
      await this.library.setMediaActive(ids, active);
      this.notify.success(fmt(this.t().api.mediaSwitchedN, { n: ids.length }));
    } catch {
      // The interceptor tells the user.
    }
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
      const f = this.folder();
      const ok = (await this.library.upload(files, f !== 'all' && f !== 'none' ? f : null)).length;
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
    this.goPost();
  }

  protected useSnippet(text: string): void {
    this.draft.appendText(text);
    this.goPost();
  }

  /** Back to the post being written in the post library's editor (the draft bar), or there with what was just added. */
  protected goPost(): void {
    void this.router.navigate([POSTS_PATH], { queryParams: newPostParams() });
  }
}
