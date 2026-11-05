export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: UserRole;
  createdAt?: string;
}

export interface AdminUser extends User {
  projectCount: number;
  assetCount: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalProjects: number;
  totalAssets: number;
  totalVersions: number;
  roleCounts: Record<UserRole, number>;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export type AssetType = "video" | "audio" | "image" | "text" | "qr" | "shape" | "slider" | "export";

export interface Asset {
  _id: string;
  original_url: string;
  preview_url: string;
  thumbnail_sprite_url?: string;
  duration: number;
  type: AssetType;
  content?: string;
  public_id: string;
}

export interface Keyframe {
  t: number;
  scale?: number;
  x?: number;
  y?: number;
}

export interface Effect {
  type: string;
  duration?: number;
  params?: Record<string, any>;
}

export interface TransformProps {
  x?: number; // Center-relative X (-480 to 480)
  y?: number; // Center-relative Y (-270 to 270)
  width?: number; // Pixel width
  height?: number; // Pixel height
  scale?: number; // Scale multiplier (default 1.0)
  rotation?: number; // Rotation in degrees (0 to 360)
  opacity?: number; // Opacity (0.0 to 1.0)
}

export interface TextStyles {
  content?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  align?: "left" | "center" | "right";
  backgroundColor?: string;
  backgroundPadding?: number;
  borderRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

export interface ShapeStyles {
  shapeType?: "rectangle" | "ellipse" | "circle" | "triangle" | "star" | "line";
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export interface QrStyles {
  qrContent?: string;
  foregroundColor?: string;
  backgroundColor?: string;
}

export interface SliderStyles {
  images?: string[];
  transition?: "left" | "right" | "fade" | "zoom";
  slideDuration?: number;
}

export interface AnimationProps {
  type?: "fade_in" | "fade_out" | "slide_left" | "slide_right" | "zoom_in" | "zoom_out" | "bounce";
  duration?: number;
}

export interface Clip {
  id: string;
  assetId: string;
  asset: Asset;
  startTime: number;
  endTime: number;
  trimIn: number;
  trimOut: number;
  volume?: number;
  muted?: boolean;
  transform?: TransformProps;
  textStyles?: TextStyles;
  shapeStyles?: ShapeStyles;
  qrStyles?: QrStyles;
  sliderStyles?: SliderStyles;
  animation?: AnimationProps;
  effects?: Effect[];
  keyframes?: Keyframe[];
}

export interface Track {
  id: string;
  type: "video" | "audio" | "text";
  clips: Clip[];
}

export interface SceneGraph {
  projectId: string;
  duration: number;
  fps: number;
  resolution: { w: number; h: number };
  tracks: Track[];
}

export interface Project {
  _id: string;
  title: string;
  duration: number;
  fps: number;
  thumbnail_url?: string;
  resolution: { w: number; h: number };
  latestVersion?: number;
}

export interface ClusterStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  totalSegmentsRendered: number;
  workers?: Array<{
    socketId: string;
    userName: string;
    status: 'IDLE' | 'BUSY';
    cores: number;
    jobsCompleted: number;
  }>;
}
