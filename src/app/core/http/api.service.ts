import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import type { PaymentRequest } from '../payments/payment.types';
import { components } from './api-schema';

type S = components['schemas'];
export type ApiPaymentConfig = S['PaymentConfigDto'];
export type ApiPaymentIntent = S['PaymentIntentDto'];
export type ApiPaymentStatus = S['PaymentStatusDto'];
export type ApiPaymentMethod = S['PaymentMethodKind'];
export type ApiPaymentFlow = S['PaymentFlow'];
export type ApiPaymentState = S['PaymentAttemptState'];
export type ApiUser = S['UserDto'];
export type ApiAuthResult = S['AuthResultDto'];
export type ApiWorkspace = S['WorkspaceDto'];
export type ApiAccount = S['AccountDto'];
export type ApiPost = S['PostDto'];
export type ApiScheduleRequest = S['ScheduleRequest'];
export type ApiScheduleResult = S['ScheduleResultDto'];
export type ApiMedia = S['MediaDto'];
export type ApiMediaFolder = S['MediaFolderDto'];
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
export type ApiPaymentOverride = S['PaymentOverrideDto'];
export type ApiCycle = S['BillingCycle'];
export type ApiCustomerStatus = S['CustomerStatus'];
export type ApiHealth = S['PlatformHealthDto'];
export type ApiAuditEntry = S['AuditEntryDto'];
export type ApiAuditAction = S['AuditAction'];
export type ApiDeviceCommand = S['DeviceCommandDto'];
export type ApiCollection = S['CollectionDto'];
export type ApiCollectionSettings = S['CollectionSettingsDto'];
export type ApiCollectionPost = S['CollectionPostDto'];
export type ApiPostSettings = S['CollectionPostSettingsDto'];
export type ApiPostActivity = S['CollectionPostActivityDto'];
export type ApiCreateMasterPost = S['CreateMasterPostRequest'];
export type ApiUpdateMasterPost = S['UpdateMasterPostRequest'];
export type ApiBulkPostAction = S['BulkPostAction'];
export type ApiApprovalAction = S['ApprovalAction'];
export type ApiLinkSet = S['LinkSetDto'];
export type ApiSetLink = S['SetLinkDto'];
export type ApiBulkLinksResult = S['BulkLinksResultDto'];
export type ApiCsvLinkRow = S['CsvLinkRow'];
export type ApiCsvImportResult = S['CsvImportResultDto'];
export type ApiGroupLink = S['GroupLinkDto'];
export type ApiNotifications = S['NotificationSettingsDto'];
export type ApiNotifyChannel = S['NotifyChannel'];
export type ApiNotifyEvents = S['NotifyEventsDto'];
export type ApiNotifyTestResult = S['NotifyTestResultDto'];
export type ApiTelegramChat = S['TelegramChatDto'];
export type ApiAutoReply = S['AutoReplyDto'];
export type ApiAutoReplyRule = S['AutoReplyRuleDto'];
export type ApiReport = S['ReportDto'];
export type ApiReportGroup = S['ReportGroupDto'];
export type ApiReportShare = S['ReportShareDto'];
export type ApiReportShareSummary = S['ReportShareSummaryDto'];
export type ApiSharedReport = S['SharedReportDto'];
export type ApiSchedule = S['ScheduleDto'];
export type ApiSaveSchedule = S['SaveScheduleRequest'];
export type ApiScheduleCreated = S['ScheduleCreatedDto'];
export type ApiScheduleMode = S['ScheduleMode'];
export type ApiBumpPlan = S['BumpPlanDto'];
export type ApiPostOrder = S['PostOrder'];
export type ApiTestPost = S['TestPostRequest'];
export type ApiManualTestPost = S['ManualTestPostRequest'];
export type ApiBackup = S['BackupDto'];
export type ApiRestoreResult = S['RestoreResultDto'];
export type ApiAiStatus = S['AiStatusDto'];
export type ApiAiRequest = S['WriteAiPostsRequest'];
export type ApiAiDrafts = S['AiDraftsDto'];

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
  /** The publishable key the in-app checkout needs (null key: Stripe's own page is used instead). */
  paymentConfig() {
    return run(this.http.get<ApiPaymentConfig>('/api/billing/payment-config', quiet));
  }
  /** Starts a payment for a plan: the server makes the Stripe PaymentIntent and answers with its client secret. */
  startPayment(request: PaymentRequest) {
    const body: S['StartPaymentRequest'] = {
      plan: request.plan,
      cycle: request.cycle,
      promoCode: request.promoCode || null,
      method: request.method,
    };
    // Quiet: the payment window shows the refusal (its reason) next to the button itself.
    return run(this.http.post<ApiPaymentIntent>('/api/billing/payments', body, quiet));
  }
  /** Reads the payment from Stripe and applies it (the webhook does the same); answers where it stands. */
  confirmPayment(id: string) {
    return run(
      this.http.post<ApiPaymentStatus>(
        `/api/billing/payments/${encodeURIComponent(id)}/confirm`,
        {},
        quiet,
      ),
    );
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

  /** Posts scheduled in [from, to) (at most 120 days). background: a live follow-up does not toast failures. */
  posts(ws: string, from: Date, to: Date, background = false) {
    const params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    return run(
      this.http.get<ApiPost[]>(`/api/workspaces/${ws}/posts`, {
        params,
        ...(background ? quiet : {}),
      }),
    );
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
  upload(ws: string, file: File, folderId?: string | null) {
    const form = new FormData();
    form.append('file', file);
    if (folderId) form.append('folderId', folderId);
    // Quiet: the library page reports rejected files itself.
    return run(this.http.post<ApiMedia>(`/api/workspaces/${ws}/media`, form, quiet));
  }
  mediaFolders(ws: string) {
    return run(this.http.get<ApiMediaFolder[]>(`/api/workspaces/${ws}/media-folders`));
  }
  createMediaFolder(ws: string, name: string) {
    return run(
      this.http.post<ApiMediaFolder>(`/api/workspaces/${ws}/media-folders`, { name }, quiet),
    );
  }
  renameMediaFolder(ws: string, id: string, name: string) {
    return run(
      this.http.put<ApiMediaFolder>(`/api/workspaces/${ws}/media-folders/${id}`, { name }, quiet),
    );
  }
  deleteMediaFolder(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/media-folders/${id}`));
  }
  /** Puts files into a folder (null = out of every folder). */
  moveMedia(ws: string, mediaIds: string[], folderId: string | null) {
    return run(
      this.http.post<ApiMedia[]>(`/api/workspaces/${ws}/media/move`, { mediaIds, folderId }),
    );
  }
  mediaContent(ws: string, id: string) {
    return run(
      this.http.get(`/api/workspaces/${ws}/media/${id}/content`, {
        ...quiet,
        responseType: 'blob',
      }),
    );
  }
  /** Changes the display name of a file (the bytes stay). */
  renameMedia(ws: string, id: string, name: string) {
    return run(this.http.put<ApiMedia>(`/api/workspaces/${ws}/media/${id}`, { name }, quiet));
  }
  /** Switches files on or off: an off file stays in the library but is not offered for new posts. */
  setMediaActive(ws: string, mediaIds: string[], active: boolean) {
    return run(
      this.http.post<ApiMedia[]>(`/api/workspaces/${ws}/media/active`, { mediaIds, active }),
    );
  }
  /** Deletes files from the library (at most 500 at a time). */
  deleteMedia(ws: string, mediaIds: string[]) {
    return run(this.http.post<void>(`/api/workspaces/${ws}/media/delete`, { mediaIds }));
  }
  snippets(ws: string) {
    return run(this.http.get<ApiSnippet[]>(`/api/workspaces/${ws}/snippets`));
  }
  createSnippet(ws: string, title: string, text: string) {
    return run(this.http.post<ApiSnippet>(`/api/workspaces/${ws}/snippets`, { title, text }));
  }
  updateSnippet(ws: string, id: string, title: string, text: string) {
    return run(this.http.put<ApiSnippet>(`/api/workspaces/${ws}/snippets/${id}`, { title, text }));
  }
  setSnippetActive(ws: string, id: string, active: boolean) {
    return run(
      this.http.put<ApiSnippet>(`/api/workspaces/${ws}/snippets/${id}/active`, { active }),
    );
  }
  deleteSnippet(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/snippets/${id}`));
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
  /**
   * Rename a browser or pause the jobs it takes (null keeps a value). A name another browser of the workspace
   * already has is refused (422, Thai reason); `own` asks for that refusal to reach the caller without a toast.
   */
  updateDevice(
    ws: string,
    id: string,
    body: { name?: string | null; jobsPaused?: boolean | null },
    own = false,
  ) {
    return run(
      this.http.put<ApiDevice>(
        `/api/workspaces/${ws}/devices/${id}`,
        { name: body.name ?? null, jobsPaused: body.jobsPaused ?? null },
        own ? quiet : {},
      ),
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
  adminUpdatePlan(key: ApiPlan, body: S['PlanSettingsRequest']) {
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
  adminPaymentOverride() {
    return run(this.http.get<ApiPaymentOverride>('/api/admin/payment-override'));
  }
  adminSetPaymentOverride(body: { enabled: boolean; amount: number; emails: string[] }) {
    return run(this.http.put<ApiPaymentOverride>('/api/admin/payment-override', body));
  }

  skipWaiting(ws: string) {
    return run(this.http.post<ApiExtensionState>(`/api/workspaces/${ws}/engine/waiting/skip`, {}));
  }

  // ---------- commands to a paired browser ----------
  /** `takeJobs` is the only command the web app sends (the extension's own campaigns are gone). */
  sendDeviceCommand(ws: string, device: string, cmd: string, args: object = {}) {
    return run(
      this.http.post<ApiDeviceCommand>(`/api/workspaces/${ws}/devices/${device}/commands`, {
        cmd,
        args,
      }),
    );
  }
  // Collections ("ชุดโพสต์"): sets of library posts with their composing settings.
  collections(ws: string, background = false) {
    return run(
      this.http.get<ApiCollection[]>(`/api/workspaces/${ws}/collections`, background ? quiet : {}),
    );
  }
  createCollection(ws: string, name: string, description?: string) {
    const body: S['CreateCollectionRequest'] = { name, description: description ?? null };
    return run(this.http.post<ApiCollection>(`/api/workspaces/${ws}/collections`, body));
  }
  updateCollection(ws: string, id: string, body: S['UpdateCollectionRequest']) {
    return run(this.http.put<ApiCollection>(`/api/workspaces/${ws}/collections/${id}`, body));
  }
  /** Off: schedules that use it queue nothing from it. */
  setCollectionActive(ws: string, id: string, active: boolean) {
    return run(
      this.http.put<ApiCollection>(`/api/workspaces/${ws}/collections/${id}/active`, { active }),
    );
  }
  deleteCollection(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/collections/${id}`));
  }
  createCollectionPost(ws: string, collection: string, text: string, mediaIds: string[] = []) {
    const body: S['CollectionPostRequest'] = { text, mediaIds };
    return run(
      this.http.post<ApiCollectionPost>(
        `/api/workspaces/${ws}/collections/${collection}/posts`,
        body,
      ),
    );
  }
  /** Several posts at once (the AI writer); at most 20. */
  createCollectionPosts(
    ws: string,
    collection: string,
    items: { text: string; mediaIds?: string[] }[],
  ) {
    const body: S['CollectionPostsBatchRequest'] = {
      items: items.map((i) => ({ text: i.text, mediaIds: i.mediaIds ?? [] })),
    };
    return run(
      this.http.post<ApiCollectionPost[]>(
        `/api/workspaces/${ws}/collections/${collection}/posts/batch`,
        body,
      ),
    );
  }
  /** Edits a post; `collectionId` moves it to another collection. */
  updateCollectionPost(
    ws: string,
    collection: string,
    id: string,
    body: S['UpdateCollectionPostRequest'],
  ) {
    return run(
      this.http.put<ApiCollectionPost>(
        `/api/workspaces/${ws}/collections/${collection}/posts/${id}`,
        body,
      ),
    );
  }
  /** Puts existing library posts into a collection (they stay in their other collections too). */
  addPostsToCollection(ws: string, collection: string, postIds: string[]) {
    const body: S['AddExistingPostsRequest'] = { postIds };
    return run(
      this.http.post<ApiCollection>(
        `/api/workspaces/${ws}/collections/${collection}/posts/add`,
        body,
      ),
    );
  }
  /** Takes a post out of THIS collection only; the post stays in the library (see deleteMasterPost). */
  deleteCollectionPost(ws: string, collection: string, id: string) {
    return run(
      this.http.delete<void>(`/api/workspaces/${ws}/collections/${collection}/posts/${id}`),
    );
  }
  collectionPostApproval(ws: string, collection: string, id: string, action: ApiApprovalAction) {
    const body: S['ApprovalRequest'] = { action };
    return run(
      this.http.post<ApiCollectionPost>(
        `/api/workspaces/${ws}/collections/${collection}/posts/${id}/approval`,
        body,
      ),
    );
  }

  // The post library ("คลังโพสต์"): every post of the workspace, whatever collections it sits in.
  masterPosts(ws: string, background = false) {
    return run(
      this.http.get<ApiCollectionPost[]>(
        `/api/workspaces/${ws}/master-posts`,
        background ? quiet : {},
      ),
    );
  }
  /** What happened to one post: one row per group it was sent to, newest first. */
  masterPostActivity(ws: string, id: string, take = 50) {
    return run(
      this.http.get<ApiPostActivity[]>(`/api/workspaces/${ws}/master-posts/${id}/activity`, {
        params: new HttpParams().set('take', take),
      }),
    );
  }
  createMasterPost(ws: string, body: ApiCreateMasterPost) {
    return run(this.http.post<ApiCollectionPost>(`/api/workspaces/${ws}/master-posts`, body));
  }
  /** `collectionIds` / `settings` null keep what the post has. */
  updateMasterPost(ws: string, id: string, body: ApiUpdateMasterPost) {
    return run(this.http.put<ApiCollectionPost>(`/api/workspaces/${ws}/master-posts/${id}`, body));
  }
  /** Off: the post is never drawn and its queued future posts are removed. */
  setMasterPostActive(ws: string, id: string, active: boolean) {
    const body: S['SetPostActiveRequest'] = { active };
    return run(
      this.http.put<ApiCollectionPost>(`/api/workspaces/${ws}/master-posts/${id}/active`, body),
    );
  }
  /** Deletes the post for good: it leaves every collection and its queued posts are removed. */
  deleteMasterPost(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/master-posts/${id}`));
  }
  masterPostApproval(ws: string, id: string, action: ApiApprovalAction) {
    const body: S['PostApprovalRequest'] = { action };
    return run(
      this.http.post<ApiCollectionPost>(`/api/workspaces/${ws}/master-posts/${id}/approval`, body),
    );
  }
  /** At most 500 posts; resolves to how many the server changed. */
  bulkMasterPosts(ws: string, postIds: string[], action: ApiBulkPostAction, collectionId?: string) {
    const body: S['BulkRequest'] = { postIds, action, collectionId: collectionId ?? null };
    return run(
      this.http.post<S['BulkMasterPostsResultDto']>(
        `/api/workspaces/${ws}/master-posts/bulk`,
        body,
      ),
    );
  }

  // Link sets ("ชุดลิงก์กลุ่ม"): Facebook group URLs with a group code and a daily cap.
  linkSets(ws: string, background = false) {
    return run(
      this.http.get<ApiLinkSet[]>(`/api/workspaces/${ws}/link-sets`, background ? quiet : {}),
    );
  }
  createLinkSet(ws: string, name: string, postAsAccountId?: string | null) {
    const body: S['CreateLinkSetRequest'] = { name, postAsAccountId: postAsAccountId ?? null };
    return run(this.http.post<ApiLinkSet>(`/api/workspaces/${ws}/link-sets`, body));
  }
  /** Off: schedules that use it queue nothing to it. */
  setLinkSetActive(ws: string, id: string, active: boolean) {
    return run(
      this.http.put<ApiLinkSet>(`/api/workspaces/${ws}/link-sets/${id}/active`, { active }),
    );
  }
  updateLinkSet(ws: string, id: string, body: S['UpdateLinkSetRequest']) {
    return run(this.http.put<ApiLinkSet>(`/api/workspaces/${ws}/link-sets/${id}`, body));
  }
  deleteLinkSet(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/link-sets/${id}`));
  }
  /** Adds a row; a blank or invalid address makes an invalid row the page shows in red. */
  addLink(
    ws: string,
    set: string,
    body: S['AddLinkRequest'] = { name: null, url: null, code: null, dailyMax: null },
  ) {
    return run(this.http.post<ApiSetLink>(`/api/workspaces/${ws}/link-sets/${set}/links`, body));
  }
  updateLink(ws: string, set: string, id: string, body: S['UpdateLinkRequest']) {
    return run(
      this.http.put<ApiSetLink>(`/api/workspaces/${ws}/link-sets/${set}/links/${id}`, body),
    );
  }
  deleteLink(ws: string, set: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/link-sets/${set}/links/${id}`));
  }
  /** Turns a link back on after the engine switched it off. */
  enableLink(ws: string, set: string, id: string) {
    return run(
      this.http.post<ApiSetLink>(`/api/workspaces/${ws}/link-sets/${set}/links/${id}/enable`, {}),
    );
  }
  /** Lines of `url | code`. */
  bulkLinks(ws: string, set: string, text: string) {
    const body: S['BulkLinksRequest'] = { text };
    return run(
      this.http.post<ApiBulkLinksResult>(`/api/workspaces/${ws}/link-sets/${set}/links/bulk`, body),
    );
  }
  /** Adds groups of a connected account (by URL) to a set. */
  importGroups(ws: string, set: string, accountId: string, urls: string[]) {
    const body: S['ImportGroupsRequest'] = { accountId, urls };
    return run(
      this.http.post<ApiLinkSet>(`/api/workspaces/${ws}/link-sets/${set}/links/import`, body),
    );
  }
  importLinksCsv(ws: string, rows: ApiCsvLinkRow[]) {
    const body: S['ImportCsvRequest'] = { rows };
    return run(
      this.http.post<ApiCsvImportResult>(`/api/workspaces/${ws}/link-sets/import-csv`, body),
    );
  }
  /** The groups a connected account's browser has synced (name + address). */
  accountGroups(ws: string, account: string) {
    return run(this.http.get<ApiGroupLink[]>(`/api/workspaces/${ws}/accounts/${account}/groups`));
  }
  // Notifications (Telegram / LINE OA), auto-reply rules and reports.
  notifications(ws: string, background = false) {
    return run(
      this.http.get<ApiNotifications>(
        `/api/workspaces/${ws}/notifications`,
        background ? quiet : {},
      ),
    );
  }
  /** Tokens are write-only: a null token keeps the stored one, an empty string clears it. */
  saveNotifications(ws: string, body: ApiNotifications) {
    return run(this.http.put<ApiNotifications>(`/api/workspaces/${ws}/notifications`, body));
  }
  /** Sends a short test message through one channel with the stored settings. */
  testNotification(ws: string, channel: 'tg' | 'line') {
    const body: S['NotifyTestRequest'] = { channel };
    return run(
      this.http.post<ApiNotifyTestResult>(`/api/workspaces/${ws}/notifications/test`, body, quiet),
    );
  }
  /** Chats the Telegram bot has seen (the typed token, or the stored one when none is given). */
  telegramChats(ws: string, token?: string) {
    const body: S['FindTelegramChatsRequest'] = { token: token || null };
    return run(
      this.http.post<S['TelegramChatsDto']>(
        `/api/workspaces/${ws}/notifications/telegram/chats`,
        body,
        quiet,
      ),
    );
  }
  autoReply(ws: string, background = false) {
    return run(
      this.http.get<ApiAutoReply>(`/api/workspaces/${ws}/auto-reply`, background ? quiet : {}),
    );
  }
  saveAutoReply(ws: string, body: ApiAutoReply) {
    return run(this.http.put<ApiAutoReply>(`/api/workspaces/${ws}/auto-reply`, body));
  }
  /** Per-group and per-post results of the last 7 or 30 days. */
  report(ws: string, days: 7 | 30) {
    const params = new HttpParams().set('days', String(days));
    return run(this.http.get<ApiReport>(`/api/workspaces/${ws}/reports`, { params }));
  }
  /** Agency: a public read-only snapshot of the report under a branded link. */
  shareReport(ws: string, body: S['ShareReportRequest']) {
    return run(this.http.post<ApiReportShare>(`/api/workspaces/${ws}/reports/share`, body));
  }
  /** Agency, admin: the client-report links that are still live, newest first. */
  reportShares(ws: string, background = false) {
    return run(
      this.http.get<ApiReportShareSummary[]>(
        `/api/workspaces/${ws}/reports/shares`,
        background ? quiet : {},
      ),
    );
  }
  /** Admin: switches one client-report link off for good (it also makes room under the limit of 20). */
  revokeReportShare(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/reports/shares/${id}`));
  }
  /** Public (no sign-in): the snapshot behind a client-report link. */
  sharedReport(token: string) {
    return run(
      this.http.get<ApiSharedReport>(`/api/reports/shared/${encodeURIComponent(token)}`, quiet),
    );
  }
  // Schedules ("ตารางโพสต์"): a collection paired with a link set and posting times.
  schedules(ws: string, background = false) {
    return run(
      this.http.get<ApiSchedule[]>(`/api/workspaces/${ws}/schedules`, background ? quiet : {}),
    );
  }
  /** Creates the schedule and queues its posts 14 days ahead (one day for "once"). */
  createSchedule(ws: string, body: ApiSaveSchedule) {
    return run(this.http.post<ApiScheduleCreated>(`/api/workspaces/${ws}/schedules`, body));
  }
  /** Pausing drops its future queued posts; resuming queues them again. */
  setScheduleActive(ws: string, id: string, active: boolean) {
    const body: S['SetActiveRequest'] = { active };
    return run(this.http.put<ApiSchedule>(`/api/workspaces/${ws}/schedules/${id}/active`, body));
  }
  renameSchedule(ws: string, id: string, name: string) {
    return run(this.http.put<ApiSchedule>(`/api/workspaces/${ws}/schedules/${id}/name`, { name }));
  }
  deleteSchedule(ws: string, id: string) {
    return run(this.http.delete<void>(`/api/workspaces/${ws}/schedules/${id}`));
  }
  /**
   * The hours (HH:00) with the most successful posts in the last 30 days, in the person's time zone. Quiet: it is
   * only a hint, so a failure shows no toast (the builder just has no suggestion).
   */
  bestTimes(ws: string, utcOffsetMinutes: number) {
    const params = new HttpParams().set('utcOffsetMinutes', String(utcOffsetMinutes));
    return run(
      this.http.get<string[]>(`/api/workspaces/${ws}/schedules/best-times`, { params, ...quiet }),
    );
  }
  /** One real post to a group now, to check the extension, the group code and the media. Quiet: the page shows the refusal. */
  testPost(ws: string, body: ApiTestPost) {
    return run(this.http.post<ApiPost>(`/api/workspaces/${ws}/test-post`, body, quiet));
  }
  /**
   * One real post typed by hand: a group or page address, a text and library files, sent through one extension
   * (`deviceId` may be left out only when exactly one is connected). Quiet: the page shows the refusal.
   */
  testPostManual(ws: string, body: ApiManualTestPost) {
    return run(this.http.post<ApiPost>(`/api/workspaces/${ws}/test-post/manual`, body, quiet));
  }
  /** Every collection, link set, schedule and setting as one file (no tokens). */
  backup(ws: string) {
    return run(this.http.get<ApiBackup>(`/api/workspaces/${ws}/backup`));
  }
  /** Replaces the workspace's collections, link sets, schedules and settings with a backup. Quiet: the dialog shows the refusal. */
  restore(ws: string, body: ApiBackup) {
    return run(this.http.post<ApiRestoreResult>(`/api/workspaces/${ws}/restore`, body, quiet));
  }

  // The AI post writer: drafts for the editor, never saved by the server.
  /** Whether the AI buttons work: the server has a key, the owner's plan has the writer, the day's allowance. Quiet. */
  aiStatus(ws: string) {
    return run(this.http.get<ApiAiStatus>(`/api/workspaces/${ws}/ai/status`, quiet));
  }
  /** 1-5 drafts for a topic (403 plan, 422 no key / the day's allowance used / the provider failed). Quiet: the panel shows the refusal. */
  aiPosts(ws: string, body: ApiAiRequest) {
    return run(this.http.post<ApiAiDrafts>(`/api/workspaces/${ws}/ai/posts`, body, quiet));
  }
}

function run<T>(o: Observable<T>): Promise<T> {
  return firstValueFrom(o);
}
