export type Post = {
  id: string;
  user_id: string | null;
  body: string;
  image_path: string | null;
  created_at: string;
};

export type PostComment = { id: string; post_id: string; body: string; created_at: string };
export type PostActivity = { post_id: string; like_count: number; comment_count: number; liked: boolean };

export type WallProfileRow = {
  id: 1;
  display_name: string;
  about: string;
  skills: string;
  website: string | null;
  github: string | null;
  linkedin: string | null;
  photo_path: string | null;
};

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: Post;
        Insert: {
          body: string;
          image_path?: string | null;
          id?: never;
          user_id?: never;
          created_at?: never;
        };
        Update: {
          body?: never;
          id?: never;
          user_id?: never;
          created_at?: never;
        };
        Relationships: [];
      };
      post_likes: {
        Row: { id: string; post_id: string; visitor_id: string };
        Insert: { post_id: string; visitor_id: string; id?: never };
        Update: Record<string, never>;
        Relationships: [];
      };
      post_comments: {
        Row: PostComment;
        Insert: { post_id: string; body: string; id?: never; created_at?: never };
        Update: Record<string, never>;
        Relationships: [];
      };
      wall_profile: {
        Row: WallProfileRow;
        Insert: {
          id?: never;
          display_name?: never;
          about?: never;
          skills?: never;
          website?: never;
          github?: never;
          linkedin?: never;
          photo_path?: never;
        };
        Update: {
          id?: never;
          display_name?: string;
          about?: string;
          skills?: string;
          website?: string | null;
          github?: string | null;
          linkedin?: string | null;
          photo_path?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      post_activity: { Row: { post_id: string; like_count: number; comment_count: number }; Relationships: [] };
    };
    Functions: {
      create_post_with_delete_capability: {
        Args: { p_body: string; p_image_path: string | null; p_delete_token: string };
        Returns: Post[];
      };
      delete_post_with_capability: {
        Args: { p_post_id: string; p_delete_token: string };
        Returns: boolean;
      };
      like_post_with_capability: {
        Args: { p_post_id: string; p_visitor_id: string; p_like_token: string };
        Returns: boolean;
      };
      unlike_post_with_capability: {
        Args: { p_post_id: string; p_visitor_id: string; p_like_token: string };
        Returns: boolean;
      };
      edit_post_with_capability: {
        Args: { p_post_id: string; p_delete_token: string; p_body: string };
        Returns: Post[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
