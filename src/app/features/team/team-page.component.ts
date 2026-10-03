import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { MemberRole } from '../../core/data/models';
import { SessionStore } from '../../core/data/session.store';
import { TeamStore } from '../../core/data/team.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-team-page',
  imports: [RouterLink, InputFieldComponent, ModalComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-page.component.html',
  styleUrl: './team-page.component.scss',
})
export class TeamPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly session = inject(SessionStore);
  private readonly admin = inject(AdminStore);
  protected readonly team = inject(TeamStore);
  private readonly workspaces = inject(WorkspaceStore);
  protected readonly t = inject(I18nService).t;

  protected readonly modal = signal<'invite' | 'ws' | 'revoke' | null>(null);
  protected readonly revokeId = signal<string | null>(null);
  protected readonly formEmail = signal('');
  protected readonly formRole = signal<string>('editor');
  protected readonly formWs = signal('');
  protected readonly formErr = signal('');

  /** Team management is an Agency feature. */
  protected readonly gated = computed(() => this.session.plan() !== 'agency');

  protected readonly memberRows = computed(() => {
    const t = this.t().team;
    const roles: Record<MemberRole, string> = {
      owner: t.rOwner,
      admin: t.rAdmin,
      editor: t.rEditor,
      viewer: t.rViewer,
    };
    // Members are sample data (no team API yet); the "you" row is the signed-in user.
    return this.team.members().map((m) => {
      const name = m.you ? this.session.name() : m.name;
      return {
        id: m.id,
        initial: name.charAt(0).toUpperCase(),
        name,
        you: m.you ? t.you : '',
        email: m.you ? this.session.email() : m.email,
        role: roles[m.role] ?? m.role,
        active: (t as Record<string, string>)[m.active] ?? m.active,
      };
    });
  });

  protected readonly devicesBody = computed(() => {
    const max = this.admin.plans()[this.session.plan()].devices;
    return max ? fmt(this.t().team.devicesBody, { n: max }) : this.t().team.devicesUnl;
  });
  protected readonly deviceRows = computed(() =>
    this.team
      .devices()
      .map((d) => ({ ...d, seenLabel: (this.t().team as Record<string, string>)[d.seen] ?? '' })),
  );
  protected readonly wsRows = computed(() =>
    this.workspaces.list().map((w) => ({
      ...w,
      meta: `${this.t().team.posts7}: ${w.posts7} · ${fmt(this.t().team.membersN, { n: w.members })}`,
      isCurrent: w.id === this.workspaces.id(),
    })),
  );
  protected readonly roleOptions = computed(() => {
    const t = this.t().team;
    return [
      { value: 'admin', label: t.rAdmin },
      { value: 'editor', label: t.rEditor },
      { value: 'viewer', label: t.rViewer },
    ];
  });

  protected open(kind: 'invite' | 'ws'): void {
    this.formEmail.set('');
    this.formRole.set('editor');
    this.formWs.set('');
    this.formErr.set('');
    this.modal.set(kind);
  }

  protected askRevoke(id: string): void {
    this.revokeId.set(id);
    this.modal.set('revoke');
  }

  protected close(): void {
    this.modal.set(null);
  }

  protected confirmInvite(): void {
    const email = this.formEmail().trim();
    if (!EMAIL_RE.test(email)) {
      this.formErr.set(this.t().team.errEmail);
      return;
    }
    this.team.invite(email, this.formRole() as MemberRole);
    this.close();
    this.notify.success(fmt(this.t().team.invited, { e: email }));
  }

  protected async confirmWs(): Promise<void> {
    const name = this.formWs().trim();
    if (!name) {
      this.formErr.set(this.t().team.errWs);
      return;
    }
    await this.workspaces.create(name);
    this.close();
    this.notify.success(fmt(this.t().team.wsCreated, { ws: name }));
  }

  protected confirmRevoke(): void {
    const id = this.revokeId();
    if (id) this.team.revokeDevice(id);
    this.close();
    this.notify.info(this.t().team.revoked);
  }

  protected switchTo(id: string): void {
    const ws = this.workspaces.switchTo(id);
    if (ws) this.notify.info(fmt(this.t().team.switched, { ws: ws.name }));
  }
}
