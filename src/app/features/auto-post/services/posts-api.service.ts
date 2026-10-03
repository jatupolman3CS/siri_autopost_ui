import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreatePostRequest, Post, UpdatePostRequest } from '../models/post.model';

// Thin HTTP wrapper around /api/posts. State lives in PostsStore, not here.
@Injectable({ providedIn: 'root' })
export class PostsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/posts`;

  list(): Observable<Post[]> {
    return this.http.get<Post[]>(this.url);
  }

  get(id: string): Observable<Post> {
    return this.http.get<Post>(`${this.url}/${id}`);
  }

  create(body: CreatePostRequest): Observable<Post> {
    return this.http.post<Post>(this.url, body);
  }

  update(id: string, body: UpdatePostRequest): Observable<Post> {
    return this.http.put<Post>(`${this.url}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
