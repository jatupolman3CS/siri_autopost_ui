import { Injectable, computed, inject } from '@angular/core';
import { ApiRole } from '../http/api.service';
import { I18nService } from '../i18n/i18n.service';
import { SessionStore } from './session.store';
import { WorkspaceStore } from './workspace.store';

const RANK: Record<ApiRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

// What the signed-in person may do in the current workspace: the single source for every `[disabled]`
// that mirrors a server check. The API's minimums: Editor = posts (schedule, delete, retry, dismiss),
// library, reconnect, skip waiting, campaigns and extension commands; Admin = anti-ban and offline
// settings, the offline simulation, devices and members. An admin seeing the app as a customer (assist
// mode) can read everything and change nothing: the API refuses every non-GET for that token.
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly workspaces = inject(WorkspaceStore);
  private readonly session = inject(SessionStore);
  private readonly i18n = inject(I18nService);

  /** The role in the current workspace; viewer (the safest) until the workspace is known. */
  readonly role = computed<ApiRole>(() => this.workspaces.current()?.role ?? 'viewer');
  /** A platform admin is looking at this customer's app. */
  readonly assist = computed(() => this.session.assist() !== null);
  /** Posts, library, reconnect, campaigns and extension commands. */
  readonly canEdit = computed(() => !this.assist() && RANK[this.role()] >= RANK.editor);
  /** Anti-ban and offline settings, simulation, devices and members. */
  readonly canAdmin = computed(() => !this.assist() && RANK[this.role()] >= RANK.admin);
  /** Nothing can be changed (viewer role, or assist mode). */
  readonly readOnly = computed(() => !this.canEdit());
  /** Creating a workspace needs no role, only a session that may write. */
  readonly canCreateWorkspace = computed(() => !this.assist());

  /** Why editing is off ('' when it is on): shown as a tooltip and a note beside the disabled control. */
  readonly editHint = computed(() =>
    this.canEdit() ? '' : this.assist() ? this.i18n.t().api.permAssist : this.i18n.t().api.permEdit,
  );
  /** Why administering is off ('' when it is on). */
  readonly adminHint = computed(() =>
    this.canAdmin()
      ? ''
      : this.assist()
        ? this.i18n.t().api.permAssist
        : this.i18n.t().api.permAdmin,
  );
}
