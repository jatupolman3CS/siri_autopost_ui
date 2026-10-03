import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { components } from './api-schema';

type S = components['schemas'];
export type ApiUser = S['UserDto'];
export type ApiAuthResult = S['AuthResultDto'];
export type ApiWorkspace = S['WorkspaceDto'];
export type ApiAccount = S['AccountDto'];
export type ApiPost = S['PostDto'];
export type ApiScheduleRequest = S['ScheduleRequest'];
export type ApiScheduleResult = S['ScheduleResultDto'];
export type ApiMedia = S['MediaDto'];
export type ApiSnippet = S['SnippetDto'];
export type ApiAntiBan = S['AntiBanDto'];
export type ApiOffline = S['OfflineDto'];
export type ApiEngine = S['EngineSettingsDto'];
export type ApiExtensionState = S['ExtensionStateDto'];
export type ApiPlan = S['PlanKey'];
export type ApiDevice = S['DeviceDto'];
export type ApiPairingCode = S['PairingCodeDto'];
export type ApiPlanSetting = S['PlanDto'];
export type ApiTransaction = S['TransactionDto'];
export type ApiBilling = S['BillingDto'];
export type ApiPlanChange = S['PlanChangeDto'];
export type ApiMember = S['MemberDto'];
export type ApiRole = S['WorkspaceRole'];
export type ApiCustomer = S['CustomerDto'];
export type ApiAdminSummary = S['AdminSummaryDto'];
export type ApiAdminJob = S['AdminJobDto'];
export type ApiPromo = S['PromoDto'];
export type ApiCycle = S['BillingCycle'];
export type ApiCustomerStatus = S['CustomerStatus'];
export type ApiHealth = S['PlatformHealthDto'];
export type ApiAuditEntry = S['AuditEntryDto'];
export type ApiAuditAction = S['AuditAction'];
export type ApiExtensionConfig = S['ExtensionConfigDto'];
export type ApiConfigSaved = S['ConfigSavedDto'];
export type ApiDeviceLive = S['DeviceLiveDto'];
export type ApiDeviceLog = S['DeviceLogDto'];
export type ApiDeviceCommand = S['DeviceCommandDto'];

/** Set on a request whose errors the caller shows itself (no toast from errorInterceptor). */
export const QUIET = new HttpContextToken<boolean>(() => false);
const quiet = { context: new HttpContext().set(QUIET, true) };

// Typed calls to SIRIAUTOPOST.Api. Shapes come from api-schema.ts (npm run gen:api).
// Every call returns a promise so the signal stores can await it.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Auth: login/signup errors are shown inline on the form.
  signUp(body: S['SignUpCommand']) {
    return run(this.http.post<ApiAuthResult>('/api/auth/signup', body, quiet));
  }
  logIn(body: S['LogInCommand']) {
    return run(this.http.post<ApiAuthResult>('/api/auth/login', body, quiet));
  }
  /** Public sign-in settings; googleClientId is null while Google sign-in is off. */
  authConfig() {
    return run(this.http.get<S['AuthConfigDto']>('/api/auth/config', quiet));
  }
  /** Signs in (or signs up) with the ID token from Google Identity Services. */
  googleLogIn(idToken: string) {
    const body: S['GoogleLogInRequest'] = { idToken };
    return run(this.http.post<ApiAuthResult>('/api/auth/google', body, quiet));
  }
  me() {
    return run(this.http.get<ApiUser>('/api/auth/me', quiet));
  }

  /** Public: prices and limits of every plan. */
  plans() {
    return run(this.http.get<ApiPlanSetting[]>('/api/plans', quiet));
  }
  /** Plan, renewal date and card of the signed-in customer. */
  billing() {
    return run(this.http.get<ApiBilling>('/api/billing'));
  }
  invoices() {
    return run(this.http.get<ApiTransaction[]>('/api/billing/invoices'));
  }
  /**
   * Chooses a plan. A paid plan for a customer with no subscription answers with the Stripe Checkout
   * address to pay at; any other change is applied at once (Free: at the end of the paid period).
   */
  changePlan(plan: ApiPlan, cycle?: ApiCycle, promoCode?: string) {
    const body: S['ChangePlanRequest'] = {
      plan,
      cycle: cycle ?? null,
      promoCode: promoCode || null,
    };
    return run(this.http.put<ApiPlanChange>('/api/billing/plan', body));
  }
  /** The customer is back from Stripe Checkout: applies the paid session. */
  confirmCheckout(sessionId: string) {
    const body: S['ConfirmCheckoutRequest'] = { sessionId };
    return run(this.http.post<ApiUser>('/api/billing/checkout/confirm', body));
  }
  /** The Stripe Billing Portal address (card, invoices, cancel). */
  billingPortal() {
    return run(this.http.post<S['UrlDto']>('/api/billing/portal', {}));
  }

  workspaces() {
    return run(this.http.get<ApiWorkspace[]>('/api/workspaces'));
  }
  createWorkspace(name: string) {
    return run(this.http.post<ApiWorkspace>('/api/workspaces', { name }));
  }
  /** background: live refreshes do not toast when the server is unreachable. */
  accounts(ws: string, background = false) {
    return run(
      this.http.get<ApiAccount[]>(`/api/workspaces/${ws}/accounts`, background ? quiet : {}),
    );
  }
  reconnect(ws: string, id: string) {
    return run(this.http.post<ApiAccount>(`/api/workspaces/${ws}/accounts/${id}/reconnect`, {}));
  }

  /** Posts scheduled in [from, to) (at most 120 days). */
  posts(ws: string, from: Date, to: Date) {
    const params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    return run(this.http.get<ApiPost[]>(`/api/workspaces/${ws}/posts`, { params }));
  }
  schedule(ws: string, body: ApiScheduleRequest) {
    return run(this.http.post<ApiScheduleResult>(`/api/workspaces/${ws}/posts/schedule`, body));
  }
  deletePost(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/posts/${id}`));
  }
  retry(ws: string, id: string) {
    return run(this.http.post<ApiPost>(`/api/workspaces/${ws}/posts/${id}/retry`, {}));
  }
  dismiss(ws: string, id: string) {
    return run(this.http.post<ApiPost>(`/api/workspaces/${ws}/posts/${id}/dismiss`, {}));
  }
  errors(ws: string) {
    return run(this.http.get<ApiPost[]>(`/api/workspaces/${ws}/errors`));
  }

  media(ws: string) {
    return run(this.http.get<ApiMedia[]>(`/api/workspaces/${ws}/media`));
  }
  upload(ws: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    // Quiet: the library page reports rejected files itself.
    return run(this.http.post<ApiMedia>(`/api/workspaces/${ws}/media`, form, quiet));
  }
  mediaContent(ws: string, id: string) {
    return run(
      this.http.get(`/api/workspaces/${ws}/media/${id}/content`, {
        ...quiet,
        responseType: 'blob',
      }),
    );
  }
  snippets(ws: string) {
    return run(this.http.get<ApiSnippet[]>(`/api/workspaces/${ws}/snippets`));
  }
  createSnippet(ws: string, title: string, text: string) {
    return run(this.http.post<ApiSnippet>(`/api/workspaces/${ws}/snippets`, { title, text }));
  }

  /** background: periodic refreshes do not toast when the server is unreachable. */
  engine(ws: string, background = false) {
    return run(this.http.get<ApiEngine>(`/api/workspaces/${ws}/engine`, background ? quiet : {}));
  }
  saveAntiBan(ws: string, body: ApiAntiBan) {
    return run(this.http.put<ApiEngine>(`/api/workspaces/${ws}/engine/anti-ban`, body));
  }
  saveOffline(ws: string, body: ApiOffline) {
    return run(this.http.put<ApiEngine>(`/api/workspaces/${ws}/engine/offline`, body));
  }
  setExtensionOnline(ws: string, online: boolean) {
    return run(
      this.http.post<ApiExtensionState>(`/api/workspaces/${ws}/engine/extension`, { online }),
    );
  }
  /** background: live refreshes do not toast when the server is unreachable. */
  devices(ws: string, background = false) {
    return run(
      this.http.get<ApiDevice[]>(`/api/workspaces/${ws}/devices`, background ? quiet : {}),
    );
  }
  createPairingCode(ws: string) {
    // Quiet: the pairing dialog shows a refusal (plan limit) itself.
    return run(this.http.post<ApiPairingCode>(`/api/workspaces/${ws}/devices/pairing`, {}, quiet));
  }
  /** Rename a browser or pause the jobs it takes (null keeps a value). */
  updateDevice(
    ws: string,
    id: string,
    body: { name?: string | null; jobsPaused?: boolean | null },
  ) {
    return run(
      this.http.put<ApiDevice>(`/api/workspaces/${ws}/devices/${id}`, {
        name: body.name ?? null,
        jobsPaused: body.jobsPaused ?? null,
      }),
    );
  }
  revokeDevice(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/devices/${id}`));
  }
  members(ws: string) {
    return run(this.http.get<ApiMember[]>(`/api/workspaces/${ws}/members`));
  }
  inviteMember(ws: string, email: string, role: ApiRole) {
    // Quiet: the invite form shows a refusal (team full, already a member) itself.
    return run(this.http.post<ApiMember>(`/api/workspaces/${ws}/members`, { email, role }, quiet));
  }
  changeMemberRole(ws: string, id: string, role: ApiRole) {
    return run(this.http.put<void>(`/api/workspaces/${ws}/members/${id}`, { role }));
  }
  removeMember(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/members/${id}`));
  }

  // ---------- platform admin ----------
  adminCustomers() {
    return run(this.http.get<ApiCustomer[]>('/api/admin/customers'));
  }
  adminSummary() {
    return run(this.http.get<ApiAdminSummary>('/api/admin/summary'));
  }
  adminHealth() {
    return run(this.http.get<ApiHealth>('/api/admin/health'));
  }
  adminAudit(customerId?: string, take = 50) {
    const params: Record<string, string> = { take: String(take) };
    if (customerId) params['customerId'] = customerId;
    return run(this.http.get<ApiAuditEntry[]>('/api/admin/audit', { params }));
  }
  /** A one-hour token to use the app as the customer. */
  adminImpersonate(id: string) {
    return run(this.http.post<ApiAuthResult>(`/api/admin/customers/${id}/impersonate`, {}));
  }
  adminJobs(customerId?: string, take = 30) {
    let params = new HttpParams().set('take', take);
    if (customerId) params = params.set('customerId', customerId);
    return run(this.http.get<ApiAdminJob[]>('/api/admin/jobs', { params }));
  }
  adminSetStatus(id: string, status: ApiCustomerStatus) {
    return run(this.http.post<ApiCustomer>(`/api/admin/customers/${id}/status`, { status }));
  }
  adminSetPaused(id: string, paused: boolean) {
    return run(this.http.post<ApiCustomer>(`/api/admin/customers/${id}/pause`, { paused }));
  }
  adminSetPlan(id: string, plan: ApiPlan) {
    return run(this.http.put<ApiCustomer>(`/api/admin/customers/${id}/plan`, { plan }));
  }
  adminSetLimits(id: string, limits: S['LimitOverridesDto']) {
    return run(this.http.put<ApiCustomer>(`/api/admin/customers/${id}/limits`, limits));
  }
  adminSetNote(id: string, note: string | null) {
    return run(this.http.put<ApiCustomer>(`/api/admin/customers/${id}/note`, { note }));
  }
  adminRevokeDevice(id: string, deviceId: string) {
    return run(this.http.delete<ApiCustomer>(`/api/admin/customers/${id}/devices/${deviceId}`));
  }
  adminRetryFailed(id: string) {
    return run(this.http.post<number>(`/api/admin/customers/${id}/retry-failed`, {}));
  }
  adminRefundLatest(id: string) {
    return run(this.http.post<ApiTransaction>(`/api/admin/customers/${id}/refund`, {}));
  }
  adminTransactions() {
    return run(this.http.get<ApiTransaction[]>('/api/admin/transactions'));
  }
  adminRefund(txId: string) {
    return run(this.http.post<ApiTransaction>(`/api/admin/transactions/${txId}/refund`, {}));
  }
  adminRetryPayment(txId: string) {
    return run(this.http.post<ApiTransaction>(`/api/admin/transactions/${txId}/retry`, {}));
  }
  adminUpdatePlan(key: ApiPlan, body: Omit<ApiPlanSetting, 'key'>) {
    return run(this.http.put<ApiPlanSetting>(`/api/admin/plans/${key}`, body));
  }
  adminPromos() {
    return run(this.http.get<ApiPromo[]>('/api/admin/promos'));
  }
  adminCreatePromo(code: string, discount: string) {
    return run(this.http.post<ApiPromo>('/api/admin/promos', { code, discount, expiresAt: null }));
  }
  adminSetPromoActive(code: string, active: boolean) {
    return run(
      this.http.put<ApiPromo>(`/api/admin/promos/${encodeURIComponent(code)}/active`, { active }),
    );
  }

  skipWaiting(ws: string) {
    return run(this.http.post<ApiExtensionState>(`/api/workspaces/${ws}/engine/waiting/skip`, {}));
  }

  // ---------- the extension's own campaigns (per paired device) ----------
  extConfig(ws: string, device: string) {
    return run(this.http.get<ApiExtensionConfig>(`/api/workspaces/${ws}/devices/${device}/config`));
  }
  /** 409 when the settings changed since baseRevision (quiet: the campaigns page explains it). */
  saveExtConfig(ws: string, device: string, settings: unknown, baseRevision: number | null) {
    return run(
      this.http.put<ApiConfigSaved>(
        `/api/workspaces/${ws}/devices/${device}/config`,
        { settings, baseRevision },
        quiet,
      ),
    );
  }
  extImage(ws: string, imageId: string) {
    return run(
      this.http.get(`/api/workspaces/${ws}/extension-images/${encodeURIComponent(imageId)}`, {
        ...quiet,
        responseType: 'blob',
      }),
    );
  }
  /** A photo or video as a data URL, stored under the extension's id. */
  putExtImage(ws: string, imageId: string, rec: { name: string; type: string; data: string }) {
    return run(
      this.http.put<void>(
        `/api/workspaces/${ws}/extension-images/${encodeURIComponent(imageId)}`,
        rec,
        quiet,
      ),
    );
  }
  /** background: the page polls it, so failures do not toast. */
  deviceLive(ws: string, device: string, background = false) {
    return run(
      this.http.get<ApiDeviceLive>(
        `/api/workspaces/${ws}/devices/${device}/live`,
        background ? quiet : {},
      ),
    );
  }
  sendDeviceCommand(ws: string, device: string, cmd: string, args: object = {}) {
    return run(
      this.http.post<ApiDeviceCommand>(`/api/workspaces/${ws}/devices/${device}/commands`, {
        cmd,
        args,
      }),
    );
  }
  deviceCommand(ws: string, device: string, id: string) {
    return run(
      this.http.get<ApiDeviceCommand>(
        `/api/workspaces/${ws}/devices/${device}/commands/${id}`,
        quiet,
      ),
    );
  }
  clearDeviceLogs(ws: string, device: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/devices/${device}/logs`));
  }
}

function run<T>(o: Observable<T>): Promise<T> {
  return firstValueFrom(o);
}
