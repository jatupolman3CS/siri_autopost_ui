import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AutoReplyStore, SCOPE_ALL, keywordsOf } from '../../core/data/auto-reply.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiAutoReplyRule } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ChipComponent } from '../../shared/components/chip/chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FeatureLockComponent } from '../../shared/components/feature-lock/feature-lock.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { RuleModalComponent } from './rule-modal.component';

interface RuleRow {
  rule: ApiAutoReplyRule;
  keywords: string[];
  scope: string;
}

// "Auto-reply (comment to inbox)": keyword rules for replying to a comment and messaging the commenter. The
// rules are only stored, because nothing reads comments yet: the page says so, the "recent comments" feed is an
// honest empty state, and the "try a rule" box matches a typed comment against the rules on this page only.
// Changing a rule is an admin's, on an owner's plan with auto-reply; the plan locks the page like notifications.
@Component({
  selector: 'app-engage-page',
  imports: [
    CheckboxComponent,
    ChipComponent,
    EmptyStateComponent,
    FeatureLockComponent,
    PermNoteComponent,
    RuleModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './engage-page.component.html',
  styleUrl: './engage-page.component.scss',
})
export class EngagePageComponent {
  protected readonly store = inject(AutoReplyStore);
  protected readonly perm = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;

  protected readonly dialog = signal(false);
  protected readonly tryText = signal('');

  /** The person may change the rules: an admin, on an owner's plan that has auto-reply. */
  protected readonly editable = computed(() => this.perm.canAdmin() && !this.store.locked());
  protected readonly hint = computed(
    () =>
      this.perm.adminHint() ||
      (this.store.locked()
        ? fmt(this.t().api.engine.planLocked, { plan: this.t().plans.pro.name })
        : ''),
  );
  protected readonly addHint = computed(() =>
    this.store.full() ? fmt(this.t().api.engine.engageFull, { n: 50 }) : this.hint(),
  );

  protected readonly rows = computed<RuleRow[]>(() =>
    this.store.rules().map((rule) => ({
      rule,
      keywords: keywordsOf(rule.keywords),
      scope: this.scopeLabel(rule.scope),
    })),
  );
  protected readonly count = computed(() =>
    fmt(this.t().api.engine.engageRuleCount, {
      n: this.store.ruleCount(),
      m: this.store.onCount(),
    }),
  );

  /** What "try a rule" says about the text typed: the prompt, the reply that would go out, or no match. */
  protected readonly tryResult = computed(() => {
    const text = this.tryText().trim();
    const t = this.t();
    if (!text) return t.ar.tryPh;
    const rule = this.store.match(text);
    return rule
      ? fmt(t.ar.tryResult, { r: rule.reply || '—', i: rule.inbox || '—' })
      : t.ar.tryNone;
  });

  private scopeLabel(scope: string): string {
    const name = this.store.scopeName(scope);
    return scope === SCOPE_ALL ? this.t().ar.scopeAll : (name ?? '—');
  }

  protected toggle(id: string, on: boolean): void {
    void this.store.setRuleOn(id, on);
  }

  protected async remove(id: string): Promise<void> {
    if (await this.store.removeRule(id)) this.notify.info(this.t().ar.deleted);
  }

  protected onTry(e: Event): void {
    this.tryText.set((e.target as HTMLInputElement).value);
  }
}
