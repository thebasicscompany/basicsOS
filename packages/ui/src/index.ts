export { cn } from "./lib/utils.js";
export { Sidebar } from "./components/Sidebar.js";
export type { SidebarItem } from "./components/Sidebar.js";
export { Button, buttonVariants } from "./components/Button.js";
export { Input } from "./components/Input.js";
export { Label } from "./components/Label.js";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/Card.js";
export { Badge, badgeVariants } from "./components/Badge.js";
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/Dialog.js";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/Select.js";
export { Avatar, AvatarImage, AvatarFallback } from "./components/Avatar.js";
export { Separator } from "./components/Separator.js";
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./components/Toast.js";
export { Toaster } from "./components/Toaster.js";
export { useToast, addToast, dismissToast } from "./hooks/useToast.js";
export type { Toast as ToastType, ToastVariant } from "./hooks/useToast.js";
export { EmptyState } from "./components/EmptyState.js";

// Curated Lucide icon re-exports
export {
  Search,
  Home,
  LayoutDashboard,
  CheckSquare,
  Users,
  Calendar,
  BookOpen,
  FileText,
  Link2,
  Bot,
  Settings,
  Shield,
  ShieldCheck,
  Mic,
  Camera,
  Video,
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Plus,
  X,
  LogOut,
  Pencil,
  Zap,
  Radio,
  Volume2,
  VolumeX,
  CheckCircle,
  MessageSquare,
  HardDrive,
  Github,
  Download,
  Briefcase,
  Check,
  MoreHorizontal,
  Trash2,
  Edit3,
  Eye,
  Clock,
  Star,
  Hash,
  Globe,
  Mail,
  Phone,
  Building2,
  DollarSign,
  BarChart3,
  Activity,
  Lock,
  Inbox,
} from "lucide-react";
