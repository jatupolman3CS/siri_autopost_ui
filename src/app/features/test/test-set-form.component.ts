import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { TestPostStore } from '../../core/data/test-post.store';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import '../../core/i18n/i18n.engine';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

// The "test from a collection" panel: pick a link set, a group or page of it, a collection and a post (or let the
// store pick one at random), optionally type another text, and send it through the chosen extension. The store
// sends and follows the post; this form only picks and shows.
@Component({
  selector: 'app-test-set-form',
  imports: [SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-set-form.component.html',
  styleUrl: './test-form.scss',
})
export class TestSetFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly collections = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly store = inject(TestPostStore);
  protected readonly t = this.i18n.t;
  protected readonly maxText = INPUT_LIMITS.postText;

  /** The sets and collections have arrived (until then the preview says "—"). */
  protected readonly loaded = this.store.setsLoaded;
  /** Pause the choices while the post is being sent. */
  protected readonly canPick = computed(() => this.perm.canEdit() && !this.store.running());

  protected readonly setOptions = computed(() =>
    this.linkSets.sets().map((s) => ({ value: s.id, label: s.name })),
  );
  /** The groups and pages of the set; a page says so (a group needs no tag: it is the usual case). */
  protected readonly groupOptions = computed(() => {
    const page = this.t().api.engine.testKindPage;
    return this.store.members().map((m) => ({
      value: m.key,
      label: m.kind === 'page' ? `${m.label} · ${page}` : m.label,
    }));
  });
  protected readonly colOptions = computed(() =>
    this.collections.collections().map((c) => ({ value: c.id, label: c.name })),
  );
  /** "Random from the collection (n posts)", then every post the test may use, numbered as in the design. */
  protected readonly postOptions = computed(() => {
    const posts = this.store.usablePosts();
    return [
      { value: '', label: fmt(this.t().test.random, { n: posts.length }) },
      ...posts.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.text.slice(0, 40)}` })),
    ];
  });

  protected readonly preview = computed(() =>
    !this.loaded() ? '—' : this.store.composed() || this.t().test.needPick,
  );
  protected readonly filesLabel = computed(() => {
    const t = this.t().test;
    const n = this.store.files();
    return n ? fmt(t.filesN, { n }) : t.noFiles;
  });

  /** Under the form, beside the run button: why it is off, or what the API refused. */
  protected readonly error = computed(() => {
    if (this.store.running()) return '';
    if (this.store.runError()) return this.store.runError();
    if (!this.loaded()) return '';
    const block = this.store.blockSet();
    return block === 'needPick'
      ? this.t().test.needPick
      : block === 'noPosts'
        ? this.t().test.noPosts
        : '';
  });
  protected readonly canRun = computed(
    () =>
      this.perm.canEdit() && this.loaded() && !this.store.running() && this.store.blockSet() === '',
  );
  protected readonly runLabel = computed(() => {
    const t = this.t().test;
    return this.store.running() ? t.running : this.store.log().length ? t.again : t.run;
  });

  protected onText(e: Event): void {
    this.store.text.set((e.target as HTMLTextAreaElement).value);
  }
}
