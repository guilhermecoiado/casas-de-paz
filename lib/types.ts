export type PostType =
  | 'individual'
  | 'group'
  | 'dynamic'
  | 'relax'
  | 'fellowship'
  | 'snack'
  | 'evangelism'
  | 'checkin'
  | 'poll';

export type ActionType = Exclude<PostType, 'poll'>;

export interface Profile {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar_url: string | null;
}

export interface PointsConfig {
  individual: number;
  group: number;
  group_bonus: number;
  dynamic: number;
  relax: number;
  fellowship: number;
  snack: number;
  evangelism: number;
  checkin: number;
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
  guests: number;
  base_points: number;
  points: number;
  group_bonus: number;
  capped: boolean;
  local_date: string;
  week: number;
  status: 'ok' | 'voting' | 'cancelled';
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
