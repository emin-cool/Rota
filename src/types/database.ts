/**
 * Supabase veritabanı tipleri.
 *
 * NOT: Bu dosya, Supabase projesi henüz bağlanmadığı için migration'dan elle yazıldı.
 * Proje bağlandıktan sonra gerçeğiyle değiştir:
 *   npm run db:types
 * Geography kolonları üretilen tiplerde `unknown` gelir; burada da öyle bırakıldı.
 */

export type ActivityType = 'walk' | 'run' | 'bike';
export type RouteType = 'loop' | 'a_b' | 'out_back';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Visibility = 'public' | 'followers' | 'private';

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: Level | null;
  activity_prefs: ActivityType[];
  default_pace_sec_per_km: number | null;
  /** İstemci tarafından okunamaz (kolon izni yok); `my_privacy_zone()` RPC'si kullanılır. */
  privacy_zone?: unknown;
  is_private: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type RouteRow = {
  id: string;
  creator_id: string | null;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  route_type: RouteType;
  geom: unknown;
  start_point: unknown;
  distance_m: number;
  elevation_gain_m: number;
  est_duration_min: number | null;
  scenic_score: number | null;
  difficulty: Difficulty | null;
  district: string | null;
  is_featured: boolean;
  is_public: boolean;
  avg_rating: number;
  rating_count: number;
  completion_count: number;
  /** [{d: metre, z: rakım}] — sihirbazdan üretilen rotalarda dolu, seed rotalarında null. */
  elevation_profile: { d: number; z: number }[] | null;
  created_at: string;
};

export type RoutePhotoRow = {
  id: string;
  route_id: string;
  user_id: string;
  url: string;
  location: unknown;
  created_at: string;
};

export type RouteReviewRow = {
  id: string;
  route_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  route_id: string | null;
  activity_type: ActivityType;
  started_at: string;
  duration_sec: number;
  moving_sec: number | null;
  distance_m: number;
  avg_pace_sec_per_km: number | null;
  elevation_gain_m: number;
  track: unknown;
  visibility: Visibility;
  title: string | null;
  created_at: string;
};

export type SavedRouteRow = {
  id: string;
  user_id: string;
  route_id: string;
  created_at: string;
};

export type RouteCacheRow = {
  id: string;
  input_hash: string;
  result: unknown;
  expires_at: string;
  created_at: string;
};

export type NearbyRoute = Pick<
  RouteRow,
  | 'id'
  | 'title'
  | 'activity_type'
  | 'route_type'
  | 'distance_m'
  | 'elevation_gain_m'
  | 'est_duration_min'
  | 'scenic_score'
  | 'difficulty'
  | 'district'
  | 'avg_rating'
  | 'rating_count'
  | 'completion_count'
  | 'is_featured'
> & {
  start_lng: number;
  start_lat: number;
  distance_to_start_m: number;
  /** Sadeleştirilmiş rota çizgisi (GeoJSON LineString). */
  geojson: { type: 'LineString'; coordinates: [number, number][] } | null;
};

type LineGeoJson = { type: 'LineString'; coordinates: [number, number][] };

/** `explore_routes` satırı (Keşfet listesi). */
export type ExploreRoute = Pick<
  RouteRow,
  | 'id'
  | 'title'
  | 'activity_type'
  | 'route_type'
  | 'distance_m'
  | 'elevation_gain_m'
  | 'est_duration_min'
  | 'scenic_score'
  | 'difficulty'
  | 'district'
  | 'avg_rating'
  | 'rating_count'
  | 'completion_count'
  | 'is_featured'
> & {
  start_lng: number;
  start_lat: number;
  geojson: LineGeoJson | null;
  saved: boolean;
  cover_url: string | null;
};

/** `route_detail` satırı. */
export type RouteDetail = Pick<
  RouteRow,
  | 'id'
  | 'title'
  | 'description'
  | 'activity_type'
  | 'route_type'
  | 'distance_m'
  | 'elevation_gain_m'
  | 'est_duration_min'
  | 'scenic_score'
  | 'difficulty'
  | 'district'
  | 'is_featured'
  | 'is_public'
  | 'avg_rating'
  | 'rating_count'
  | 'completion_count'
  | 'created_at'
  | 'creator_id'
  | 'elevation_profile'
> & {
  start_lng: number;
  start_lat: number;
  geojson: LineGeoJson;
  creator_name: string | null;
  creator_avatar: string | null;
  photos: string[];
  saved: boolean;
};

export type RatingSummary = {
  count: number;
  avg: number;
  dist: Record<'1' | '2' | '3' | '4' | '5', number>;
  tags: { tag: string; count: number }[];
};

export type ReviewListItem = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  is_verified: boolean;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  photos: string[];
  mine: boolean;
};

export type PoiType = 'water' | 'toilet' | 'cafe' | 'bench' | 'transit';
export type PoiSummary = { poi_type: PoiType; n: number; sample_name: string | null };

export type ExploreArgs = {
  p_query?: string | null;
  p_activity?: ActivityType | null;
  p_min_duration?: number | null;
  p_max_duration?: number | null;
  p_difficulty?: Difficulty | null;
  p_district?: string | null;
  p_min_rating?: number | null;
  p_featured_only?: boolean;
  p_sort?: 'popular' | 'featured' | 'newest';
  p_limit?: number;
  p_offset?: number;
  p_scope?: 'public' | 'mine' | 'saved';
};

export type MyStats = {
  total_distance_m: number;
  activity_count: number;
  total_duration_sec: number;
};

export type PrivacyZoneInfo = { lng: number; lat: number; radius_m: number };

/** Profil "Aktivitelerim" listesi satırı. */
export type ActivityListItem = Pick<
  ActivityRow,
  | 'id'
  | 'title'
  | 'activity_type'
  | 'started_at'
  | 'duration_sec'
  | 'distance_m'
  | 'avg_pace_sec_per_km'
  | 'elevation_gain_m'
  | 'route_id'
>;

export type ProfileUpdate = Partial<
  Pick<
    ProfileRow,
    | 'username'
    | 'display_name'
    | 'avatar_url'
    | 'level'
    | 'activity_prefs'
    | 'default_pace_sec_per_km'
    | 'is_private'
    | 'onboarding_completed'
  >
>;

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, never, ProfileUpdate>;
      routes: Table<
        RouteRow,
        Partial<RouteRow> & Pick<RouteRow, 'title' | 'activity_type' | 'route_type' | 'distance_m'>,
        Partial<Pick<RouteRow, 'title' | 'description' | 'difficulty' | 'district' | 'is_public'>>
      >;
      route_photos: Table<
        RoutePhotoRow,
        Partial<RoutePhotoRow> & Pick<RoutePhotoRow, 'route_id' | 'user_id' | 'url'>,
        never
      >;
      route_reviews: Table<
        RouteReviewRow,
        Partial<RouteReviewRow> & Pick<RouteReviewRow, 'route_id' | 'user_id' | 'rating'>,
        Partial<Pick<RouteReviewRow, 'rating' | 'comment' | 'tags'>>
      >;
      activities: Table<
        ActivityRow,
        Partial<ActivityRow> &
          Pick<
            ActivityRow,
            'user_id' | 'activity_type' | 'started_at' | 'duration_sec' | 'distance_m'
          >,
        Partial<ActivityRow>
      >;
      saved_routes: Table<SavedRouteRow, Pick<SavedRouteRow, 'user_id' | 'route_id'>, never>;
      route_cache: Table<RouteCacheRow, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      nearby_routes: {
        Args: { lng: number; lat: number; radius_m?: number; activity?: ActivityType | null };
        Returns: NearbyRoute[];
      };
      explore_routes: { Args: ExploreArgs; Returns: ExploreRoute[] };
      route_districts: { Args: Record<string, never>; Returns: string[] };
      route_detail: { Args: { p_id: string }; Returns: RouteDetail[] };
      route_rating_summary: { Args: { p_id: string }; Returns: RatingSummary };
      route_reviews_list: {
        Args: { p_id: string; p_limit?: number; p_offset?: number };
        Returns: ReviewListItem[];
      };
      route_pois: { Args: { p_id: string }; Returns: PoiSummary[] };
      my_stats: { Args: Record<string, never>; Returns: MyStats[] };
      my_weekly_distance: {
        Args: Record<string, never>;
        Returns: { day: string; distance_m: number | string }[];
      };
      set_privacy_zone: {
        Args: { p_lng: number; p_lat: number; p_radius_m: number };
        Returns: undefined;
      };
      clear_privacy_zone: { Args: Record<string, never>; Returns: undefined };
      my_privacy_zone_info: { Args: Record<string, never>; Returns: PrivacyZoneInfo[] };
      my_privacy_zone: { Args: Record<string, never>; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
