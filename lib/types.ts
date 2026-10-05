export type PostType =
  | 'individual'
  | 'group'
  | 'dynamic'
  | 'relax'
  | 'fellowship'
  | 'snack'
  | 'evangelism'
  | 'checkin'
  | 'poll'
  | 'adjust'
  | 'streak'
  | 'verse'
  | 'encourage'
  | 'devotional'
  | 'prayer'
  | 'fasting'
  | 'testimony';

export type ActionType = Exclude<PostType, 'poll' | 'adjust' | 'streak'>;

export interface Profile {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar_url: string | null;
}

export interface PointsConfig {
  // dia do encontro
  checkin: number;
  group: number;
  group_bonus: number;
  dynamic: number;
  relax: number;
  fellowship: number;
  snack: number;
  // dia a dia (até 3x por dia)
  individual: number;
  verse: number;
  encourage: number;
  devotional: number;
  prayer: number;
  fasting: number;
  testimony: number;
  evangelism: number;
  poll: number;
}

export interface Group {
  id: string;
  name: string;
  admin_id: string;
  start_date: string;
  end_date: string;
  house_weekday: number;
  post_mode: 'all' | 'selected';
  post_weekdays: number[];
  weekly_user_cap: number;
  weekly_group_cap: number;
  points: PointsConfig;
  background_url: string | null;
  timezone: string;
  reminder_enabled: boolean;
  digest_enabled: boolean;
  digest_hours: number;
  last_digest_at: string | null;
  nudge_enabled: boolean;
  last_nudge_date: string | null;
  recap_enabled: boolean;
  last_recap_week: number | null;
  checkin_qr: boolean;
  group_cap_auto: boolean;
  group_cap_factor: number;
  diminishing: boolean;
}

export interface Member {
  group_id: string;
  user_id: string;
  joined_at: string;
  title: string | null;
  avatar_frame: string | null;
  tile_frame: string | null;
  tile_color: string | null;
  tile_anim: string | null;
}

export interface Post {
  id: string;
  group_id: string;
  user_id: string;
  type: PostType;
  photo_url: string | null;
  description: string | null;
  poll_id?: string | null;
  guests: number;
  guest_names?: string[];
  boost?: number; // parte dobrada pelo intensivo (fora do limite semanal)
  base_points: number;
  points: number;
  group_bonus: number;
  capped: boolean;
  local_date: string;
  week: number;
  status: 'ok' | 'voting' | 'cancelled' | 'archived' | 'removed';
  created_at: string;
}

export interface Vote {
  post_id: string;
  group_id: string;
  user_id: string;
  keep: boolean;
}

export interface Poll {
  id: string;
  group_id: string;
  question: string;
  options: string[];
  poll_date: string;
  created_at: string;
  archived?: boolean;
}

export interface PollAnswer {
  poll_id: string;
  group_id: string;
  user_id: string;
  option_index: number;
}

export interface Message {
  id: number;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface PushLog {
  id: number;
  group_id: string;
  kind: 'reminder' | 'manual';
  title: string;
  body: string;
  recipients: number;
  devices: number;
  local_date: string;
  created_at: string;
}

export const REACTIONS = ['🙏', '❤️', '🔥', '🙌', '😂'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export interface Reaction {
  post_id: string;
  group_id: string;
  user_id: string;
  emoji: ReactionEmoji;
  created_at: string;
}

export interface Comment {
  id: number;
  post_id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface AppNotification {
  id: number;
  user_id: string;
  group_id: string;
  kind: 'comment' | 'digest' | 'reminder' | 'manual' | 'nudge' | 'recap' | 'prayer' | 'reset';
  title: string;
  body: string;
  url: string;
  actor_id: string | null;
  post_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PrayerRequest {
  id: number;
  group_id: string;
  user_id: string;
  body: string;
  answered_at: string | null;
  created_at: string;
}

export interface PrayerAmen {
  request_id: number;
  group_id: string;
  user_id: string;
  created_at: string;
}

export interface MemberItem {
  post_id: string;
  group_id: string;
  user_id: string;
  item_id: string;
  created_at: string;
}

export interface StreakAward {
  group_id: string;
  user_id: string;
  level: 7 | 14 | 21 | 28;
  local_date: string;
  post_id: string | null;
  created_at: string;
}
