export { cn } from "./lib/utils";
export { Sidebar } from "./components/Sidebar";
export type { SidebarItem } from "./components/Sidebar";
export { Button, buttonVariants } from "./components/Button";
export { Input } from "./components/Input";
export { Label } from "./components/Label";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/Card";
export { Badge, badgeVariants } from "./components/Badge";
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
} from "./components/Dialog";
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
} from "./components/Select";
export { Avatar, AvatarImage, AvatarFallback } from "./components/Avatar";
export { Separator } from "./components/Separator";
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./components/Toast";
export { Toaster } from "./components/Toaster";
export { useToast, addToast, dismissToast } from "./hooks/useToast";
export type { Toast as ToastType, ToastVariant } from "./hooks/useToast";
export { EmptyState } from "./components/EmptyState";

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
  Copy,
} from "lucide-react";
