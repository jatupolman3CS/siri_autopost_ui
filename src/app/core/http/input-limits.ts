// How much the API accepts per field (the backend's Validators.cs and domain constants). Inputs stop
// at these so a long text is cut by the browser instead of refused by the server.
export const INPUT_LIMITS = {
  /** Post.MaxContentLength */
  postText: 5000,
  /** SchedulePostsCommandValidator.MaxMedia */
  postMedia: 20,
  /** The collections one post may sit in, and its own per-day cap (CollectionPostSettings) */
  postCollections: 50,
  postMaxPerDay: 50,
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
  /** The AI writer's inputs (WriteAiPostsCommandHandler.MaxTopicLength / MaxPointLength / MaxPoints) */
  aiTopic: 300,
  aiPointLength: 200,
  aiPoints: 10,
  /** A platform's posts per 24 hours on the anti-ban page (AntiBanSettings.MaxDailyLimit) */
  platformDailyLimit: 500,
  /** BumpPlan: times a post is bumped, the comment's text, the library images to draw from and per bump */
  bumpRounds: 3,
  bumpText: 1000,
  bumpPool: 20,
  bumpImages: 5,
  /** Promo codes: letters and digits, 3-30 (Promo.Create) */
  promoMin: 3,
  promoMax: 30,
  /** LineOptions.SkipIfActiveMinutes: how long a customer who wrote last counts as mid-conversation (5-240 minutes) */
  lineSkipMin: 5,
  lineSkipMax: 240,
  /** LinkSet.MaxLinksFor(line): customer chats in one LINE link set (a Facebook set holds 200) */
  lineLinksPerSet: 2000,
  /** The anti-ban gap between two chats, in seconds: the web asks for 20-3600 (the API accepts 1-3600; tests use small values) */
  lineGapMin: 20,
  lineGapMax: 3600,
} as const;

/** `HH:mm`, 00:00 to 23:59: the only form the API reads for the allowed hours of a LINE schedule (TimeOfDay). */
export const LINE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
