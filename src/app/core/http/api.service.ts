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
  me() {
    return run(this.http.get<ApiUser>('/api/auth/me', quiet));
  }
  changePlan(plan: ApiPlan) {
    return run(this.http.put<ApiUser>('/api/auth/me/plan', { plan }));
  }

  workspaces() {
    return run(this.http.get<ApiWorkspace[]>('/api/workspaces'));
  }
  createWorkspace(name: string) {
    return run(this.http.post<ApiWorkspace>('/api/workspaces', { name }));
  }
  accounts(ws: string) {
    return run(this.http.get<ApiAccount[]>(`/api/workspaces/${ws}/accounts`));
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

  engine(ws: string) {
    return run(this.http.get<ApiEngine>(`/api/workspaces/${ws}/engine`));
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
  skipWaiting(ws: string) {
    return run(this.http.post<ApiExtensionState>(`/api/workspaces/${ws}/engine/waiting/skip`, {}));
  }
}

function run<T>(o: Observable<T>): Promise<T> {
  return firstValueFrom(o);
}
