import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { SettingsStore } from '../../core/data/settings.store';
import { TeamStore } from '../../core/data/team.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { fmtDate, hm } from '../../core/i18n/format';
import { ApiMember, ApiRole } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { problemMessage } from '../../core/http/problem-details';
import '../../core/i18n/i18n.engine';
import { I18nService, ago, fmt } from '../../core/i18n/i18n.service';
import { autoPauseLine } from '../../core/data/auto-pause-line';
import { autoPauseOf } from '../../core/data/devices.store';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { PairDeviceModalComponent } from './pair-device-modal.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-team-page',
  imports: [
    PagerComponent,
    RouterLink,
    InputFieldComponent,
    ModalComponent,
    PermNoteComponent,
    SelectFieldComponent,
    PairDeviceModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-page.component.html',
  styleUrl: './team-page.component.scss',
})
export class TeamPageComponent {
  /** ?pair=1 (from a page that cannot work without a paired browser): opens the pairing dialog at once. */
  readonly pair = input<string>();

  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly team = inject(TeamStore);
  protected readonly devices = inject(DevicesStore);
  private readonly accounts = inject(AccountsStore);
  private readonly settings = inject(SettingsStore);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly limits = INPUT_LIMITS;
  protected readonly modal = signal<
    'invite' | 'ws' | 'revoke' | 'pair' | 'remove' | 'rename' | null
  >(null);
  protected readonly revokeId = signal<string | null>(null);
  protected readonly renameId = signal<string | null>(null);
  protected readonly formName = signal('');
  /** A request from a dialog is on its way: its confirm button waits. */
  protected readonly busy = signal(false);
  protected readonly removing = signal<ApiMember | null>(null);
  protected readonly formEmail = signal('');
  protected readonly formRole = signal<string>('editor');
  protected readonly formWs = signal('');
  protected readonly formErr = signal('');

  /** The owner's limits (plan and the platform admin's overrides), whoever looks at the page. */
  private readonly limitsNow = computed(() => this.workspaces.current()?.limits ?? null);
  /** Seats (owner included) come from the owner's plan; one seat leaves no room to invite. */
  protected readonly gated = computed(
    () => this.team.role() === 'owner' && this.limitsNow()?.seats === 1,
  );
  protected readonly canInvite = computed(
    () => this.team.canManage() && !this.gated() && !this.team.seatsFull(),
  );
  /** Why "invite" is off when the role would allow it: the seats are taken. */
  protected readonly seatsNote = computed(() =>
    this.team.canManage() && !this.gated() && this.team.seatsFull()
      ? fmt(this.t().api.seatsFull, { n: this.team.seatLimit() ?? 0 })
      : '',
  );
  /** Every device the plan allows is paired: the API would refuse another pairing code. */
  protected readonly devicesFull = computed(() => {
    const max = this.limitsNow()?.devices ?? null;
    return max !== null && this.devices.list().length >= max;
  });
  protected readonly addDeviceHint = computed(() =>
    !this.perm.canAdmin()
      ? this.perm.adminHint()
      : this.devicesFull()
        ? fmt(this.t().api.devicesFull, { n: this.limitsNow()?.devices ?? 0 })
        : '',
  );
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
        remove: owner
          ? ''
          : m.you
            ? this.perm.assist()
              ? ''
              : t.api.leaveTeam
            : manage
              ? t.api.removeMember
              : '',
      };
    });
  });

  protected readonly memberPager = new Pager(20);
  protected readonly memberPage = computed(() => this.memberPager.slice(this.memberRows()));

  protected readonly removeTitle = computed(() =>
    this.removing()?.you ? this.t().api.leaveTeam : this.t().api.removeMember,
  );

  protected readonly devicesBody = computed(() => {
    const max = this.limitsNow()?.devices;
    return max ? fmt(this.t().team.devicesBody, { n: max }) : this.t().team.devicesUnl;
  });
  /** "n/m extensions online" when there are several browsers (one browser has its own dot and status line). */
  protected readonly onlineLabel = computed(() => {
    const list = this.devices.list();
    return list.length > 1
      ? fmt(this.t().api.extCount, { n: list.filter((d) => d.online).length, m: list.length })
      : '';
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
      const auto = autoPauseOf(d, this.devices.now());
      return {
        id: d.id,
        name: d.name,
        online: d.online,
        paused: d.jobsPaused,
        /** The engine paused this browser itself (a block, or posts that kept failing): until when and why. */
        autoPause: auto ? autoPauseLine(auto, this.devices.now(), t, li) : '',
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
  protected readonly devicePager = new Pager(20);
  protected readonly devicePage = computed(() => this.devicePager.slice(this.deviceRows()));
  protected readonly wsPager = new Pager(20);
  protected readonly wsPage = computed(() => this.wsPager.slice(this.wsRows()));
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
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.team.invite(email, this.formRole() as ApiRole);
    } catch (e) {
      this.formErr.set(problemMessage(e) ?? this.t().api.serverDown);
      return;
    } finally {
      this.busy.set(false);
    }
    this.close();
    this.notify.success(fmt(this.t().team.invited, { e: email }));
  }

  /** Changes a member's role; when the API refuses, the select goes back to the role they have. */
  protected async setRole(m: ApiMember, select: HTMLSelectElement): Promise<void> {
    try {
      await this.team.changeRole(m.id!, select.value as ApiRole);
      this.notify.success(this.t().api.saved);
    } catch {
      select.value = m.role;
    }
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
    if (this.busy() || !this.perm.canCreateWorkspace()) return;
    this.busy.set(true);
    try {
      await this.workspaces.create(name);
    } catch {
      return; // the interceptor says why (name too long, ...); the dialog stays open
    } finally {
      this.busy.set(false);
    }
    this.close();
    this.notify.success(fmt(this.t().team.wsCreated, { ws: name }));
  }

  /** The new device brings its Facebook account and puts the extension online. */
  constructor() {
    effect(() => {
      if (this.pair() === undefined || !this.devices.loaded()) return;
      untracked(() => {
        if (this.perm.canAdmin() && !this.devicesFull()) this.modal.set('pair');
        void this.router.navigate([], {
          queryParams: { pair: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected onPaired(): void {
    this.syncAfterDeviceChange();
  }

  private syncAfterDeviceChange(): void {
    void Promise.all([this.settings.refreshPresence(true), this.accounts.refresh()]).catch(
      () => undefined,
    );
  }

  protected async confirmRevoke(): Promise<void> {
    const id = this.revokeId();
    this.close();
    if (!id) return;
    await this.devices.revoke(id);
    this.notify.info(this.t().team.revoked);
    this.syncAfterDeviceChange();
  }

  /** Owners and admins control the paired browsers (the server refuses lower roles too). */
  protected readonly canManageDevices = this.team.canManage;

  protected askRename(id: string, current: string): void {
    this.renameId.set(id);
    this.formName.set(current);
    this.formErr.set('');
    this.modal.set('rename');
  }

  protected async confirmRename(): Promise<void> {
    const id = this.renameId();
    const name = this.formName().trim();
    const current = this.devices.list().find((d) => d.id === id)?.name;
    if (!id || this.busy()) return;
    if (!name) {
      this.formErr.set(this.t().api.renameEmpty);
      return;
    }
    if (name === current) return this.close();
    this.busy.set(true);
    this.formErr.set('');
    try {
      await this.devices.rename(id, name);
    } catch (e) {
      // Names are unique in a workspace: the server's refusal ("already used") shows under the field, the dialog
      // stays open and the browser keeps the name it had.
      this.formErr.set(problemMessage(e) ?? this.t().api.serverDown);
      return;
    } finally {
      this.busy.set(false);
    }
    this.close();
    this.notify.success(fmt(this.t().api.renamed, { d: name }));
    this.syncAfterDeviceChange();
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
