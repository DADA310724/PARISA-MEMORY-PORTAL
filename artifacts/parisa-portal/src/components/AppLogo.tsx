import {
  SiWhatsapp, SiMessenger, SiTelegram, SiYoutube, SiInstagram, SiFacebook,
  SiSnapchat, SiX, SiGmail, SiGoogledrive, SiGooglephotos, SiSpotify,
  SiTiktok, SiViber, SiSignal, SiLine,
} from "react-icons/si";
import {
  Camera, Music, Video, Wand2, Folder, FileText, Mic, Image, Globe,
  MessageCircle, Phone, Star, Heart, Shield, Lock, Key, Archive,
} from "lucide-react";

export const LOGO_OPTIONS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "messenger", label: "Messenger" },
  { key: "telegram", label: "Telegram" },
  { key: "photos", label: "Photos" },
  { key: "videos", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "magic", label: "Black Magic" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "snapchat", label: "Snapchat" },
  { key: "twitter", label: "Twitter/X" },
  { key: "gmail", label: "Gmail" },
  { key: "drive", label: "Google Drive" },
  { key: "googlephotos", label: "Google Photos" },
  { key: "spotify", label: "Spotify" },
  { key: "tiktok", label: "TikTok" },
  { key: "viber", label: "Viber" },
  { key: "signal", label: "Signal" },
  { key: "line", label: "Line" },
  { key: "imo", label: "IMO" },
  { key: "camera", label: "Camera" },
  { key: "music", label: "Music" },
  { key: "video", label: "Video" },
  { key: "mic", label: "Microphone" },
  { key: "image", label: "Image" },
  { key: "globe", label: "Website" },
  { key: "chat", label: "Chat" },
  { key: "phone", label: "Phone" },
  { key: "star", label: "Star" },
  { key: "heart", label: "Heart" },
  { key: "shield", label: "Shield" },
  { key: "lock", label: "Lock" },
  { key: "key", label: "Key" },
  { key: "archive", label: "Archive" },
  { key: "doc", label: "Document" },
  { key: "folder", label: "Folder" },
];

const LOGO_CONFIG: Record<string, { bg: string; iconColor: string }> = {
  whatsapp:    { bg: "bg-green-500",                                         iconColor: "text-white" },
  messenger:   { bg: "bg-gradient-to-br from-purple-500 to-blue-500",        iconColor: "text-white" },
  telegram:    { bg: "bg-sky-500",                                           iconColor: "text-white" },
  photos:      { bg: "bg-gradient-to-br from-rose-400 via-amber-400 to-green-400", iconColor: "text-white" },
  videos:      { bg: "bg-gradient-to-br from-indigo-500 to-violet-600",      iconColor: "text-white" },
  audio:       { bg: "bg-gradient-to-br from-amber-400 to-orange-500",       iconColor: "text-white" },
  magic:       { bg: "bg-gradient-to-br from-violet-600 to-purple-800",      iconColor: "text-white" },
  instagram:   { bg: "bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400", iconColor: "text-white" },
  facebook:    { bg: "bg-blue-600",                                          iconColor: "text-white" },
  youtube:     { bg: "bg-red-600",                                           iconColor: "text-white" },
  snapchat:    { bg: "bg-yellow-400",                                        iconColor: "text-black" },
  twitter:     { bg: "bg-black",                                             iconColor: "text-white" },
  gmail:       { bg: "bg-red-500",                                           iconColor: "text-white" },
  drive:       { bg: "bg-gradient-to-br from-blue-500 via-green-500 to-yellow-400", iconColor: "text-white" },
  googlephotos:{ bg: "bg-gradient-to-br from-rose-400 via-amber-300 to-green-400", iconColor: "text-white" },
  spotify:     { bg: "bg-green-500",                                         iconColor: "text-black" },
  tiktok:      { bg: "bg-black",                                             iconColor: "text-white" },
  viber:       { bg: "bg-purple-600",                                        iconColor: "text-white" },
  signal:      { bg: "bg-blue-500",                                          iconColor: "text-white" },
  line:        { bg: "bg-green-500",                                         iconColor: "text-white" },
  imo:         { bg: "bg-teal-500",                                          iconColor: "text-white" },
  camera:      { bg: "bg-slate-700",                                         iconColor: "text-white" },
  music:       { bg: "bg-rose-500",                                          iconColor: "text-white" },
  video:       { bg: "bg-indigo-600",                                        iconColor: "text-white" },
  mic:         { bg: "bg-amber-500",                                         iconColor: "text-white" },
  image:       { bg: "bg-pink-500",                                          iconColor: "text-white" },
  globe:       { bg: "bg-teal-500",                                          iconColor: "text-white" },
  chat:        { bg: "bg-cyan-500",                                          iconColor: "text-white" },
  phone:       { bg: "bg-emerald-500",                                       iconColor: "text-white" },
  star:        { bg: "bg-yellow-500",                                        iconColor: "text-white" },
  heart:       { bg: "bg-rose-500",                                          iconColor: "text-white" },
  shield:      { bg: "bg-teal-600",                                          iconColor: "text-white" },
  lock:        { bg: "bg-slate-600",                                         iconColor: "text-white" },
  key:         { bg: "bg-amber-600",                                         iconColor: "text-white" },
  archive:     { bg: "bg-slate-700",                                         iconColor: "text-white" },
  doc:         { bg: "bg-blue-500",                                          iconColor: "text-white" },
  folder:      { bg: "bg-amber-500",                                         iconColor: "text-white" },
};

function getIconNode(logoKey: string, size: number) {
  const px = size * 4;
  switch (logoKey) {
    case "whatsapp":    return <SiWhatsapp size={px} />;
    case "messenger":   return <SiMessenger size={px} />;
    case "telegram":    return <SiTelegram size={px} />;
    case "photos":      return <Image size={px} />;
    case "videos":      return <Video size={px} />;
    case "audio":       return <Mic size={px} />;
    case "magic":       return <Wand2 size={px} />;
    case "instagram":   return <SiInstagram size={px} />;
    case "facebook":    return <SiFacebook size={px} />;
    case "youtube":     return <SiYoutube size={px} />;
    case "snapchat":    return <SiSnapchat size={px} />;
    case "twitter":     return <SiX size={px} />;
    case "gmail":       return <SiGmail size={px} />;
    case "drive":       return <SiGoogledrive size={px} />;
    case "googlephotos":return <SiGooglephotos size={px} />;
    case "spotify":     return <SiSpotify size={px} />;
    case "tiktok":      return <SiTiktok size={px} />;
    case "viber":       return <SiViber size={px} />;
    case "signal":      return <SiSignal size={px} />;
    case "line":        return <SiLine size={px} />;
    case "imo":         return <MessageCircle size={px} />;
    case "camera":      return <Camera size={px} />;
    case "music":       return <Music size={px} />;
    case "video":       return <Video size={px} />;
    case "mic":         return <Mic size={px} />;
    case "image":       return <Image size={px} />;
    case "globe":       return <Globe size={px} />;
    case "chat":        return <MessageCircle size={px} />;
    case "phone":       return <Phone size={px} />;
    case "star":        return <Star size={px} />;
    case "heart":       return <Heart size={px} />;
    case "shield":      return <Shield size={px} />;
    case "lock":        return <Lock size={px} />;
    case "key":         return <Key size={px} />;
    case "archive":     return <Archive size={px} />;
    case "doc":         return <FileText size={px} />;
    default:            return <Folder size={px} />;
  }
}

interface AppLogoProps {
  logoKey: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AppLogo({ logoKey, size = 10, className = "", style }: AppLogoProps) {
  const config = LOGO_CONFIG[logoKey] ?? LOGO_CONFIG.folder;
  return (
    <div className={`rounded-2xl flex items-center justify-center ${config.bg} ${config.iconColor} ${className}`} style={style}>
      {getIconNode(logoKey, size)}
    </div>
  );
}

export function getLogoConfig(logoKey: string) {
  return LOGO_CONFIG[logoKey] ?? LOGO_CONFIG.folder;
}
