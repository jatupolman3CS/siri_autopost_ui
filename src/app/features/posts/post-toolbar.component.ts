import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiStore } from '../../core/data/ai.store';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { PopComponent } from './pop.component';
import { PostHelpComponent } from './post-help.component';
import { SpintaxPopoverComponent } from './spintax-popover.component';
import '../../core/i18n/i18n.flow';

// The row above the text of a post: `{{code}} Group code`, `{ } Spintax`, `Snippet`, `AI` and the "?" help.
// Always visible (nothing is folded away). The buttons only SAY what to put in (`code`, `spin`, `snippet`,
// `example`, `wrap`); the editor puts it at the caret, because it owns the text area. The AI button is off,
// with the reason beside it, while the server has no AI key, the plan has no AI, or the person cannot edit
// (`AiStore.state`); while the status has not arrived it is a placeholder.
@Component({
  selector: 'app-post-toolbar',
  imports: [PopComponent, PostHelpComponent, RouterLink, SpintaxPopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-toolbar.component.html',
  styleUrl: './post-toolbar.component.scss',
})
export class PostToolbarComponent {
  protected readonly perm = inject(PermissionsService);
  protected readonly ai = inject(AiStore);
  private readonly library = inject(LibraryStore);
  protected readonly t = inject(I18nService).t;

  /** The words selected in the text right now ('' = none). */
  readonly selection = input('');
  /** The AI panel is open. */
  readonly aiOpen = input(false);

  /** Write `{{code}}` at the caret. */
  readonly code = output<void>();
  /** Write a saved text at the caret. */
  readonly snippet = output<string>();
  /** Write a complete spintax group at the caret (in place of the selection). */
  readonly spin = output<string>();
  /** Make the selected words a spintax group. */
  readonly wrap = output<void>();
  /** Write one of the help's examples at the caret. */
  readonly example = output<string>();
  /** Open or close the AI panel. */
  readonly aiToggle = output<void>();

  /** Only snippets that are switched on can be inserted (an off one stays in the library). */
  protected readonly snippets = computed(() =>
    this.library.snippets().filter((s) => s.active !== false),
  );
  /** The note under the row: why AI cannot be used (not shown to a viewer, whose whole page is off already). */
  protected readonly showReason = computed(
    () => this.ai.state() !== 'ready' && this.ai.state() !== 'readonly' && !!this.ai.reason(),
  );
}
