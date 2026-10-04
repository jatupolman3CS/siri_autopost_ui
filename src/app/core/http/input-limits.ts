// How much the API accepts per field (the backend's Validators.cs and domain constants). Inputs stop
// at these so a long text is cut by the browser instead of refused by the server.
export const INPUT_LIMITS = {
  /** Post.MaxContentLength */
  postText: 5000,
  /** SchedulePostsCommandValidator.MaxMedia */
  postMedia: 20,
  /** Snippet.MaxTitleLength / MaxTextLength */
  snippetTitle: 120,
  snippetText: 2000,
  /** Workspace.MaxNameLength */
  workspaceName: 120,
  /** Device.MaxNameLength */
  deviceName: 80,
  /** PostCollection.MaxNameLength / MaxDescriptionLength */
  collectionName: 120,
  collectionDescription: 300,
  /** CollectionSettings: hashtags, page tags, footer */
  hashtags: 500,
  pageTags: 1000,
  footer: 1000,
  /** The AI writer's inputs (nothing server side: the posts it makes stay far below the 5000 of a post) */
  aiTopic: 200,
  aiPoints: 600,
  /** Promo codes: letters and digits, 3-30 (Promo.Create) */
  promoMin: 3,
  promoMax: 30,
} as const;
