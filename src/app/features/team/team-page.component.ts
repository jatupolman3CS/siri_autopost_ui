import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { AdminStore } from '../../core/data/admin.store';
import { DevicesStore } from '../../core/data/devices.store';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { TeamStore } from '../../core/data/team.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { fmtDate, hm } from '../../core/i18n/format';
import { ApiMember, ApiRole } from '../../core/http/api.service';
import { problemOf } from '../../core/http/problem-details';
import { I18nService, ago, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { PairDeviceModalComponent } from './pair-device-modal.component';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-team-page',
  imports: [
    RouterLink,
    InputFieldComponent,
    ModalComponent,
    SelectFieldComponent,
    PairDeviceModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-page.component.html',
  styleUrl: './team-page.component.scss',
})
export class TeamPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly session = inject(SessionStore);
  private readonly admin = inject(AdminStore);
  protected readonly team = inject(TeamStore);
  protected readonly devices = inject(DevicesStore);
  private readonly accounts = inject(AccountsStore);
  private readonly settings = inject(SettingsStore);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly modal = signal<'invite' | 'ws' | 'revoke' | 'pair' | 'remove' | null>(null);
  protected readonly revokeId = signal<string | null>(null);
  protected readonly removing = signal<ApiMember | null>(null);
  protected readonly formEmail = signal('');
  protected readonly formRole = signal<string>('editor');
  protected readonly formWs = signal('');
  protected readonly formErr = signal('');

  /** Seats (owner included) come from the owner's plan; one seat leaves no room to invite. */
  protected readonly gated = computed(
    () => this.team.role() === 'owner' && this.admin.plans()[this.session.plan()].seats === 1,
  );
  protected readonly canInvite = computed(() => this.team.canManage() && !this.gated());
  protected readonly roleNote = computed(() =>
    this.team.role() === 'owner'
      ? ''
      : fmt(this.t().api.roleHere, { r: this.roleNames()[this.team.role()] }),
  );

  private readonly roleNames = computed<Record<ApiRole, string>>(() => {
    const t = this.t().team;
    return { owner: t.rOwner, admin: t.rAdmin, editor: t.rEditor, viewer: t.rViewer };
  });

  protected readonly memberRows = computed(() => {
    const t = this.t();
    const roles = this.roleNames();
    const manage = this.team.canManage();
    return this.team.members().map((m) => {
      const owner = m.role === 'owner';
      return {
        m,
        key: m.id ?? 'owner',
        initial: (m.name || m.email).charAt(0).toUpperCase(),
        name: m.name || m.email.split('@')[0],
        you: m.you ? t.team.you : '',
        email: m.email,
        role: roles[m.role],
        /** Owners and admins change the others' roles; nobody changes the owner's. */
        editRole: manage && !owner && !m.you,
        active: m.active
          ? ago(t, m.lastSeenAt ? new Date(m.lastSeenAt) : null)
          : t.api.invitePending,
        pending: !m.active,
        remove: owner ? '' : m.you ? t.api.leaveTeam : manage ? t.api.removeMember : '',
      };
    });
  });

  protected readonly removeTitle = computed(() =>
    this.removing()?.you ? this.t().api.leaveTeam : this.t().api.removeMember,
  );

  protected readonly devicesBody = computed(() => {
    const max = this.admin.plans()[this.session.plan()].devices;
    return max ? fmt(this.t().team.devicesBody, { n: max }) : this.t().team.devicesUnl;
  });
  protected readonly deviceRows = computed(() => {
    const { t, li } = { t: this.t(), li: this.i18n.li() };
    return this.devices.list().map((d) => {
      const seen = d.lastSeenAt ? new Date(d.lastSeenAt) : null;
      const status = d.online
        ? t.api.deviceOnline
        : seen
          ? `${t.team.lastSeen} ${fmtDate(seen, li)} ${hm(seen)}`
          : t.api.deviceNever;
      return {
        id: d.id,
        name: d.name,
        online: d.online,
        paused: d.jobsPaused,
        meta: [d.browser, d.version && 'v' + d.version, status, d.jobsPaused && t.api.jobsPausedTag]
          .filter(Boolean)
          .join(' · '),
      };
    });
  });
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

  protected async confirmInvite(): Promise<void> {
    const email = this.formEmail().trim();
    if (!EMAIL_RE.test(email)) {
      this.formErr.set(this.t().team.errEmail);
      return;
    }
    try {
      await this.team.invite(email, this.formRole() as ApiRole);
    } catch (e) {
      this.formErr.set(problemOf(e)?.title ?? this.t().api.serverDown);
      return;
    }
    this.close();
    this.notify.success(fmt(this.t().team.invited, { e: email }));
  }

  protected async setRole(m: ApiMember, role: string): Promise<void> {
    await this.team.changeRole(m.id!, role as ApiRole);
    this.notify.success(this.t().api.saved);
  }

  protected askRemove(m: ApiMember): void {
    this.removing.set(m);
    this.modal.set('remove');
  }

  protected async confirmRemove(): Promise<void> {
    const m = this.removing();
    this.close();
    if (!m) return;
    await this.team.remove(m);
    this.notify.info(fmt(this.t().api.removed, { e: m.email }));
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

  /** The new device brings its Facebook account and puts the extension online. */
  protected onPaired(): void {
    void Promise.all([this.settings.refreshPresence(), this.accounts.load()]);
  }

  protected async confirmRevoke(): Promise<void> {
    const id = this.revokeId();
    this.close();
    if (!id) return;
    await this.devices.revoke(id);
    this.notify.info(this.t().team.revoked);
    void Promise.all([this.settings.refreshPresence(), this.accounts.load()]);
  }

  /** Owners and admins control the paired browsers (the server refuses lower roles too). */
  protected readonly canManageDevices = this.team.canManage;

  protected async renameDevice(id: string, current: string): Promise<void> {
    const name = prompt(this.t().api.renamePrompt, current)?.trim();
    if (!name || name === current) return;
    await this.devices.update(id, { name });
    this.notify.success(fmt(this.t().api.renamed, { d: name }));
    void this.accounts.load();
  }

  protected async toggleJobs(id: string, paused: boolean): Promise<void> {
    await this.devices.update(id, { jobsPaused: !paused });
    this.notify.info(paused ? this.t().api.jobsResumedNote : this.t().api.jobsPausedNote);
  }

  protected switchTo(id: string): void {
    const ws = this.workspaces.switchTo(id);
    if (ws) this.notify.info(fmt(this.t().team.switched, { ws: ws.name }));
  }
}
